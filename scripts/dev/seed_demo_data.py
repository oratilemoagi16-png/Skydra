#!/usr/bin/env python3
"""Seed Skydra with realistic Litchi-format demo flight logs for development/QA.

Usage:
    python3 scripts/dev/seed_demo_data.py                 # posts to http://localhost:3001
    SKYDRA_API=http://host:3001 python3 scripts/dev/seed_demo_data.py

Generates five flights (grid survey, orbit, waypoint) around Johannesburg with
plausible telemetry at 8 Hz and imports them via POST /api/import.
"""
import csv, io, math, os, random, urllib.request, datetime

API = os.environ.get("SKYDRA_API", "http://localhost:3001").rstrip("/")

COLS = [
    "dronetype","planename","latitude","longitude","altitude(m)","ultrasonicHeight(m)",
    "speed(m/s)","velocityX(m/s)","velocityY(m/s)","velocityZ(m/s)",
    "pitch","roll","yaw","gimbalPitch","gimbalRoll","gimbalYaw",
    "gimbalPitchRaw","gimbalRollRaw","gimbalYawRaw",
    "satellites","flightmode","isflying","isTakingVideo","istakingphoto",
    "remainPowerPercent","voltage","currentVoltage","currentCurrent","currentElectricity",
    "batteryTemperature(c)","temperature(c)",
    "uplinkSignalQuality","downlinkSignalQuality",
    "Rc_aileron","Rc_elevator","Rc_rudder","Rc_throttle",
    "time(millisecond)","datetime(utc)","home_latitude","home_longitude",
    "BatterySerialNumber","FlyControllerSerialNumber",
]

def noise(v, a): return v + random.uniform(-a, a)

def flight_rows(kind, home_lat, home_lon, start_dt, drone, plane, bat_serial, fc_serial,
                duration_s=420, hz=8):
    """Yield dicts simulating a realistic flight."""
    rows = []
    n = duration_s * hz
    dt_ms = int(1000 / hz)
    lat = home_lat; lon = home_lon
    # mission params
    if kind == "grid":
        cell = 0.0009   # ~100m legs
        legs = [(0,1),(1,0),(0,-1),(0,-1),(-1,0),(0,1),(0,1),(1,0),(0,-1),(-1,0)]
        leg_len = 8 * hz
        alt_cruise = 82.0
        speed_cruise = 7.5
    elif kind == "orbit":
        radius = 0.0011  # ~120m
        alt_cruise = 95.0
        speed_cruise = 6.0
    else:  # waypoint
        wps = [(0.0012,0.0015),(0.0024,-0.0008),(-0.0005,-0.0022),(-0.0018,0.0006)]
        alt_cruise = 65.0
        speed_cruise = 9.0
    alt = 0.0; heading = 0.0; bat = 97; cap = 5000; video_on = False
    phase = "takeoff"; leg_i = 0; leg_t = 0; orb_t = 0.0; wp_i = 0
    for i in range(n):
        t_ms = i * dt_ms
        t = t_ms / 1000.0
        ts = start_dt + datetime.timedelta(milliseconds=t_ms)
        # phases
        if i < 12*hz: phase = "takeoff"
        elif i > n - 15*hz: phase = "landing"
        else: phase = "mission"
        if phase == "takeoff":
            alt = min(alt_cruise, (i/(12*hz)) * alt_cruise)
            speed = 0.3
        elif phase == "landing":
            k = (n - i) / (15*hz)
            alt = max(0.0, alt_cruise * k)
            speed = 0.4
            lat += (home_lat-lat)*0.004; lon += (home_lon-lon)*0.004
        else:
            speed = speed_cruise
            if kind == "grid":
                d = legs[leg_i % len(legs)]
                heading = math.degrees(math.atan2(d[0], d[1]))
                lat += d[1]*cell/leg_len; lon += d[0]*cell/leg_len
                leg_t += 1
                if leg_t >= leg_len: leg_i += 1; leg_t = 0
            elif kind == "orbit":
                orb_t += (speed_cruise / (radius*111320)) / hz * (math.pi/180)
                lat = home_lat + radius*math.cos(orb_t)
                lon = home_lon + radius*math.sin(orb_t)/math.cos(math.radians(home_lat))
                heading = math.degrees(orb_t) + 90
            else:
                wp = wps[wp_i % len(wps)]
                dlat = home_lat+wp[0]-lat; dlon = home_lon+wp[1]-lon
                dist = math.hypot(dlat, dlon*math.cos(math.radians(home_lat)))
                if dist < 0.00015: wp_i += 1
                else:
                    heading = math.degrees(math.atan2(dlon, dlat))
                    step = speed*dt_ms/1000/111320/max(dist,1e-9)
                    lat += dlat*step; lon += dlon*step
        if i == int(n*0.25) and kind != "grid": video_on = True
        if i == int(n*0.55): video_on = False
        photo = 1 if (kind=="grid" and phase=="mission" and i % (6*hz) < 2) else 0
        vel_n = speed*math.cos(math.radians(heading)); vel_e = speed*math.sin(math.radians(heading))
        bat = max(18, 97 - (i/n)*68 + random.uniform(-0.02,0.02))
        row = {
            "dronetype": drone, "planename": plane,
            "latitude": f"{noise(lat,0.0000012):.7f}", "longitude": f"{noise(lon,0.0000012):.7f}",
            "altitude(m)": f"{noise(alt,0.4):.2f}", "ultrasonicHeight(m)": f"{max(0,noise(alt,0.15)):.2f}",
            "speed(m/s)": f"{noise(speed,0.35):.2f}",
            "velocityX(m/s)": f"{noise(vel_e,0.3):.2f}", "velocityY(m/s)": f"{noise(vel_n,0.3):.2f}",
            "velocityZ(m/s)": f"{noise((0.9 if phase=='takeoff' else -0.6 if phase=='landing' else 0),0.15):.2f}",
            "pitch": f"{noise(-8 if speed>2 else 0, 2.5):.2f}", "roll": f"{noise(0,2.0):.2f}",
            "yaw": f"{(noise(heading,3))%360:.2f}",
            "gimbalPitch": f"{noise(-72 if kind!='waypoint' else -30, 2):.2f}",
            "gimbalRoll": f"{noise(0,0.5):.2f}", "gimbalYaw": f"{noise(heading,4)%360:.2f}",
            "gimbalPitchRaw": f"{noise(-72 if kind!='waypoint' else -30,2):.2f}",
            "gimbalRollRaw": f"{noise(0,0.5):.2f}", "gimbalYawRaw": f"{noise(heading,4)%360:.2f}",
            "satellites": random.randint(15,22), "flightmode": phase if phase!="mission" else ("GPS" if kind!="grid" else "Waypoint"),
            "isflying": 1, "isTakingVideo": 1 if video_on else 0, "istakingphoto": photo,
            "remainPowerPercent": int(bat),
            "voltage": f"{noise(15.2-(97-bat)*0.03,0.05):.2f}",
            "currentVoltage": f"{noise(15200-(97-bat)*30,50):.0f}",
            "currentCurrent": f"{noise(-(4+ speed*1.4 + (3 if phase=='takeoff' else 0)),0.8):.2f}",
            "currentElectricity": f"{cap*bat/100:.0f}",
            "batteryTemperature(c)": f"{noise(24+(97-bat)*0.12,0.4):.1f}",
            "temperature(c)": f"{noise(23.5,0.6):.1f}",
            "uplinkSignalQuality": random.randint(82,100), "downlinkSignalQuality": random.randint(78,100),
            "Rc_aileron": f"{noise(0,18) if speed>2 else noise(0,3):.0f}",
            "Rc_elevator": f"{noise(22 if speed>2 else 0,6):.0f}",
            "Rc_rudder": f"{noise(0,5):.0f}", "Rc_throttle": f"{noise(48 if phase!='landing' else 30,8):.0f}",
            "time(millisecond)": t_ms, "datetime(utc)": ts.strftime("%Y-%m-%d %H:%M:%S.")+f"{ts.microsecond//1000:03d}",
            "home_latitude": f"{home_lat:.7f}", "home_longitude": f"{home_lon:.7f}",
            "BatterySerialNumber": bat_serial, "FlyControllerSerialNumber": fc_serial,
        }
        rows.append(row)
    return rows

def make_csv(rows):
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=COLS)
    w.writeheader()
    for r in rows: w.writerow(r)
    return buf.getvalue().encode()

def import_file(name, data):
    boundary = "----skydraBoundary"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"file\"; filename=\"{name}\"\r\n"
            f"Content-Type: text/csv\r\n\r\n").encode() + data + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request(API + "/api/import", data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"})
    try:
        with urllib.request.urlopen(req, timeout=300) as r:
            print(name, "->", r.status, r.read()[:300])
    except urllib.error.HTTPError as e:
        print(name, "-> HTTP", e.code, e.read()[:500])

random.seed(42)
jobs = [
    ("Roosevelt Park survey — grid.csv","grid", -26.1425, 27.9940, datetime.datetime(2026,9,5,8,14,22), "Mavic 3E","Roosevelt Grid A","BAT3E-0091","FC3E-8842",470),
    ("Delta Park orbit — tower.csv","orbit", -26.1470, 28.0030, datetime.datetime(2026,9,8,17,41,5), "Mavic 3E","Delta Tower Orbit","BAT3E-0091","FC3E-8842",300),
    ("Melville koppies waypoint.csv","waypoint", -26.1760, 27.9980, datetime.datetime(2026,9,12,6,58,47), "Mavic 3E","Koppies Ridge Line","BAT3E-0144","FC3E-8842",390),
    ("Emmarentia dam inspection.csv","grid", -26.1580, 27.9990, datetime.datetime(2026,9,15,15,22,10), "Mini 4 Pro","Dam Wall Survey","BATM4-0033","FCM4-2201",380),
    ("Randjesfontein property orbit.csv","orbit", -25.9660, 28.1200, datetime.datetime(2026,9,16,11,5,33), "Mini 4 Pro","Randjes POI","BATM4-0033","FCM4-2201",260),
]
for name, kind, hlat, hlon, dt, drone, plane, bs, fs, dur in jobs:
    rows = flight_rows(kind, hlat, hlon, dt, drone, plane, bs, fs, duration_s=dur)
    import_file(name, make_csv(rows))
print("done")
