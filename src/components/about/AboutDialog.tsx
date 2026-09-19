/**
 * About / Licenses / Source surface.
 *
 * Implements the attribution surface specified in docs/research/legal-attribution.md §2:
 * AGPL §5 attribution chain (Open DroneLog → Skydra), a bundled license + generated
 * third-party inventory, and the AGPL §13 offer-of-source link for network deployments.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuExternalLink, LuGithub } from 'react-icons/lu';
import licensesData from '@/generated/licenses.json';

interface LicenseEntry {
  name: string;
  version?: string | null;
  license?: string | null;
  url?: string;
  copyright?: string;
  note?: string;
}

interface LicenseGroup {
  id: string;
  title: string;
  entries: LicenseEntry[];
}

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

type AboutTab = 'about' | 'licenses' | 'source';

const SOURCE_URL = 'https://github.com/oratilemoagi16-png/Skydra';
const UPSTREAM_URL = 'https://github.com/arpanghosh8453/open-dronelog';
const GENERATED_GROUPS = new Set(['javascript', 'rust']);

const groups = licensesData.groups as unknown as LicenseGroup[];

function ExternalLink({ href, children, className = '' }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-accent hover:text-accent-hover transition-colors ${className}`}
    >
      {children}
      <LuExternalLink className="w-3 h-3 shrink-0" />
    </a>
  );
}

export function AboutDialog({ isOpen, onClose }: AboutDialogProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<AboutTab>('about');
  const [filter, setFilter] = useState('');
  const [licenseText, setLicenseText] = useState<string | null>(null);
  const [licenseTextError, setLicenseTextError] = useState(false);
  const [showLicenseText, setShowLicenseText] = useState(false);

  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';

  useEffect(() => {
    if (!isOpen) {
      setTab('about');
      setFilter('');
      setShowLicenseText(false);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!showLicenseText || licenseText !== null) return;
    fetch(`${import.meta.env.BASE_URL}LICENSE.txt`)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(String(r.status)))))
      .then(setLicenseText)
      .catch(() => setLicenseTextError(true));
  }, [showLicenseText, licenseText]);

  const curatedGroups = useMemo(() => groups.filter((g) => !GENERATED_GROUPS.has(g.id)), []);
  const inventoryGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return groups
      .filter((g) => GENERATED_GROUPS.has(g.id))
      .map((g) => ({
        ...g,
        entries: q
          ? g.entries.filter((e) =>
              `${e.name} ${e.version ?? ''} ${e.license ?? ''}`.toLowerCase().includes(q))
          : g.entries,
      }));
  }, [filter]);

  const inventoryTotal = useMemo(
    () => inventoryGroups.reduce((sum, g) => sum + g.entries.length, 0),
    [inventoryGroups],
  );

  if (!isOpen) return null;

  const tabs: { id: AboutTab; label: string }[] = [
    { id: 'about', label: t('about.tabAbout', 'About') },
    { id: 'licenses', label: t('about.tabLicenses', 'Licenses') },
    { id: 'source', label: t('about.tabSource', 'Source') },
  ];

  return (
    <div className="fixed inset-0 z-[80] flex flex-col items-center p-4 overflow-y-auto mobile-safe-container">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-elevated rounded-xl border border-line shadow-overlay w-full max-w-2xl max-h-[calc(100vh-2rem)] flex flex-col my-auto">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-line">
          <h2 className="text-base font-semibold text-ink">{t('about.title', 'About Skydra')}</h2>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-line overflow-hidden">
              {tabs.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    tab === id
                      ? 'bg-accent text-accent-ink'
                      : 'text-muted hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={onClose}
              className="text-faint hover:text-ink transition-colors"
              aria-label={t('flightList.close', 'Close')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto settings-scroll p-4">
          {tab === 'about' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <img src="skydra-wordmark.png" alt="" className="h-8 w-auto" />
                <div>
                  <div className="text-lg font-semibold text-ink leading-tight">Skydra</div>
                  <div className="text-xs text-muted font-mono">v{version}</div>
                </div>
                <span className="ml-auto text-[11px] font-medium px-2 py-1 rounded-md border border-line text-muted">
                  AGPL-3.0-only
                </span>
              </div>

              <p className="text-sm text-muted">
                {t('about.tagline', 'Drone flight operations and log analysis.')}
              </p>

              <div className="rounded-lg border border-line bg-surface p-3 text-sm text-muted space-y-1.5">
                <p>
                  {t(
                    'about.attribution',
                    'Skydra is based on Open DroneLog (AGPL-3.0). Copyright © 2026 Arpan Ghosh and contributors; Skydra modifications © 2026 Oratile Moagi.',
                  )}
                </p>
                <p>
                  <ExternalLink href={UPSTREAM_URL}>
                    github.com/arpanghosh8453/open-dronelog
                  </ExternalLink>
                </p>
              </div>

              <p className="text-xs text-faint">
                {t(
                  'about.trademarks',
                  'DJI, Litchi, Airdata, and other product names are trademarks of their respective owners and are not affiliated with Skydra.',
                )}
              </p>
            </div>
          )}

          {tab === 'licenses' && (
            <div className="space-y-4">
              {/* Product license */}
              <div className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-sm font-medium text-ink">
                      GNU Affero General Public License v3.0
                    </div>
                    <div className="text-xs text-muted">
                      {t('about.productLicense', 'Skydra is licensed AGPL-3.0-only.')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowLicenseText((v) => !v)}
                    className="text-xs text-accent hover:text-accent-hover transition-colors"
                  >
                    {showLicenseText
                      ? t('about.hideLicenseText', 'Hide license text')
                      : t('about.viewLicenseText', 'View license text')}
                  </button>
                </div>
                {showLicenseText && (
                  <div className="mt-3 max-h-64 overflow-y-auto rounded-md border border-line bg-canvas p-3">
                    {licenseText === null && !licenseTextError && (
                      <p className="text-xs text-muted">{t('about.loadingLicense', 'Loading…')}</p>
                    )}
                    {licenseTextError && (
                      <ExternalLink href={`${import.meta.env.BASE_URL}LICENSE.txt`} className="text-xs">
                        LICENSE.txt
                      </ExternalLink>
                    )}
                    {licenseText !== null && (
                      <pre className="text-[11px] leading-relaxed text-muted whitespace-pre-wrap font-mono">
                        {licenseText}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Curated notices (upstream, fonts, map data) */}
              {curatedGroups.map((group) => (
                <div key={group.id}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-faint mb-2">
                    {group.title}
                  </h3>
                  <div className="space-y-2">
                    {group.entries.map((entry) => (
                      <div key={entry.name} className="rounded-lg border border-line bg-surface p-3">
                        <div className="flex items-baseline justify-between gap-2 flex-wrap">
                          <span className="text-sm font-medium text-ink">{entry.name}</span>
                          {entry.license && (
                            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded border border-line text-muted">
                              {entry.license}
                            </span>
                          )}
                        </div>
                        {entry.copyright && (
                          <div className="text-xs text-muted mt-0.5">{entry.copyright}</div>
                        )}
                        {entry.note && <div className="text-xs text-muted mt-1">{entry.note}</div>}
                        {entry.url && (
                          <ExternalLink href={entry.url} className="text-xs mt-1">
                            {entry.url.replace(/^https?:\/\//, '')}
                          </ExternalLink>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Generated inventory */}
              <div>
                <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">
                    {t('about.thirdParty', 'Third-party dependencies')}
                  </h3>
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={t('about.filterPlaceholder', 'Filter packages…')}
                    className="h-7 w-44 px-2 rounded-md border border-line bg-canvas text-xs text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-focus"
                  />
                </div>
                <p className="text-[11px] text-faint mb-2">
                  {t('about.inventoryCount', '{{count}} packages', { count: inventoryTotal })}
                </p>
                <div className="space-y-2">
                  {inventoryGroups.map((group) => (
                    <InventoryGroupView key={group.id} group={group} filtering={filter.trim() !== ''} />
                  ))}
                  {inventoryTotal === 0 && (
                    <p className="text-xs text-muted">{t('about.noMatches', 'No matching packages.')}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'source' && (
            <div className="space-y-4">
              <p className="text-sm text-muted">
                {t(
                  'about.sourceIntro',
                  'Skydra is free software under the GNU Affero General Public License v3.0 (AGPL-3.0-only). The complete corresponding source code for this version is publicly available:',
                )}
              </p>
              <a
                href={SOURCE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 hover:border-line-strong transition-colors"
              >
                <LuGithub className="w-5 h-5 text-ink shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-ink">
                    {t('about.sourceRepo', 'Source code repository')}
                  </span>
                  <span className="block text-xs text-accent font-mono truncate">
                    github.com/oratilemoagi16-png/Skydra
                  </span>
                </span>
                <LuExternalLink className="w-4 h-4 text-faint ml-auto shrink-0" />
              </a>
              <p className="text-xs text-faint">
                {t(
                  'about.agplSection13',
                  'Under AGPL §13, users interacting with Skydra over a network are entitled to the Corresponding Source of this modified version. The repository above satisfies that offer while it remains publicly accessible.',
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InventoryGroupView({ group, filtering }: { group: LicenseGroup; filtering: boolean }) {
  const { t } = useTranslation();
  const byLicense = useMemo(() => {
    const map = new Map<string, LicenseEntry[]>();
    for (const e of group.entries) {
      const key = e.license ?? 'Unknown';
      const list = map.get(key);
      if (list) list.push(e);
      else map.set(key, [e]);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [group.entries]);

  return (
    <details className="rounded-lg border border-line bg-surface" open={filtering}>
      <summary className="flex items-center justify-between px-3 py-2 cursor-pointer select-none text-sm font-medium text-ink">
        <span>{group.title}</span>
        <span className="text-[11px] font-mono text-faint">{group.entries.length}</span>
      </summary>
      <div className="border-t border-line px-3 py-2">
        {filtering ? (
          <InventoryRows entries={group.entries} />
        ) : (
          byLicense.map(([license, entries]) => (
            <details key={license} className="group/lic">
              <summary className="flex items-center justify-between py-1.5 cursor-pointer select-none text-xs text-muted hover:text-ink">
                <span className="font-mono">{license}</span>
                <span className="text-faint">{entries.length}</span>
              </summary>
              <InventoryRows entries={entries} />
            </details>
          ))
        )}
        {group.entries.length === 0 && (
          <p className="py-2 text-xs text-muted">{t('about.noMatches', 'No matching packages.')}</p>
        )}
      </div>
    </details>
  );
}

function InventoryRows({ entries }: { entries: LicenseEntry[] }) {
  return (
    <ul className="divide-y divide-line/60">
      {entries.map((e) => (
        <li key={`${e.name}@${e.version}`} className="flex items-baseline justify-between gap-3 py-1">
          <span className="text-xs text-ink font-mono break-all min-w-0">
            {e.name}
            {e.version && <span className="text-faint">@{e.version}</span>}
          </span>
          <span className="text-[10px] text-faint font-mono shrink-0 text-right">
            {e.license ?? 'Unknown'}
            {e.note && <span className="block text-[10px] normal-case">{e.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
