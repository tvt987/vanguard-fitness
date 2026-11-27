import React from 'react';
import type { Lang } from '../i18n/translations';
import { COPY } from '../i18n/translations';
import { DumbbellIcon, SnowflakeIcon } from './Icons';

interface SpacesSectionProps {
  lang: Lang;
}

export const SpacesSection: React.FC<SpacesSectionProps> = ({ lang }) => {
  const t = COPY[lang].spaces;

  const spaces = [
    {
      id: 'recovery',
      image: './images/pilates-cryo.webp',
      alt: 'Vanguard Reformer Pilates Atelier and 4.8°C Basalt Cold Plunge Sanctuary',
      tag: t.card1Tag,
      title: t.card1Title,
      desc: t.card1Desc,
      icon: SnowflakeIcon,
      accentClass: 'text-[var(--vg-cryo)]',
      metrics:
        lang === 'en'
          ? ['4.8°C BASALT PLUNGE', '68°C CEDAR INFRARED', '10 WALNUT REFORMERS']
          : ['NGÂM LẠNH 4.8°C', 'XÔNG HỒNG NGOẠI 68°C', '10 MÁY REFORMER GỖ ÓC CHÓ'],
    },
    {
      id: 'force',
      image: './images/turf-lab.webp',
      alt: 'Vanguard Iron Vault Barbell Lab and Calibrated HYROX Sprint Turf',
      tag: t.card2Tag,
      title: t.card2Title,
      desc: t.card2Desc,
      icon: DumbbellIcon,
      accentClass: 'text-[var(--vg-accent)]',
      metrics:
        lang === 'en'
          ? ['ELEIKO IWF PLATES', 'VELOCITY RACKS', '25M HYROX TURF']
          : ['BÁNH TẠ ELEIKO IWF', 'RACK ĐO VẬN TỐC', 'SÂN CỎ HYROX 25M'],
    },
  ];

  return (
    <section
      id="sanctuaries"
      className="no-print border-b border-[var(--vg-border)] bg-[var(--vg-surface-alt)]/35 py-14 sm:py-16"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="font-mono-num text-[11px] font-semibold tracking-[0.18em] text-[var(--vg-accent)]">
            {t.eyebrow}
          </p>
          <h2 className="font-display mt-2 text-2xl font-bold text-[var(--vg-ink)] sm:text-3xl lg:text-4xl">
            {t.title}
          </h2>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {spaces.map((space) => {
            const Icon = space.icon;
            return (
              <article
                key={space.id}
                className="group overflow-hidden rounded-2xl border border-[var(--vg-border)] bg-[var(--vg-surface)] transition-colors hover:border-[var(--vg-accent)]/60"
              >
                <div className="relative overflow-hidden bg-[#08090c]">
                  <img
                    src={space.image}
                    alt={space.alt}
                    width={1200}
                    height={750}
                    loading="lazy"
                    className="aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08090c]/90 via-[#08090c]/15 to-transparent" />
                  <div className="absolute top-3.5 left-3.5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-[#08090c]/80 px-3 py-1 font-mono-num text-[10px] font-semibold tracking-[0.14em] text-[#e2e8f0] backdrop-blur-md">
                    <Icon className={`h-3.5 w-3.5 ${space.accentClass}`} />
                    <span>{space.tag}</span>
                  </div>
                </div>

                <div className="p-5 sm:p-6">
                  <h3 className="font-display text-xl font-bold text-[var(--vg-ink)] sm:text-2xl">
                    {space.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-[var(--vg-muted)]">
                    {space.desc}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {space.metrics.map((metric) => (
                      <span
                        key={metric}
                        className="rounded-md border border-[var(--vg-border)] bg-[var(--vg-surface-alt)] px-2.5 py-1 font-mono-num text-[10px] font-semibold tracking-[0.08em] text-[var(--vg-ink)]"
                      >
                        {metric}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
};
