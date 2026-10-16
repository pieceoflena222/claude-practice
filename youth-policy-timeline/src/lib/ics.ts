import type { Policy } from '../types';

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** 마감일을 종일 일정으로 담은 .ics 파일을 내려받는다 (3일 전 알림 포함) */
export function downloadDeadlineIcs(p: Policy, fallbackUrl: string): void {
  if (!p.applyEnd) return;
  const d = p.applyEnd.replace(/-/g, '');
  const next = new Date(`${p.applyEnd}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dEnd = next.toISOString().slice(0, 10).replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const url = p.applyUrl || fallbackUrl;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//my-policy-timeline//KO',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${esc(p.id)}-${d}@my-policy-timeline`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${dEnd}`,
    `SUMMARY:${esc(`[신청 마감] ${p.title}`)}`,
    `DESCRIPTION:${esc(`${p.summary}\n신청/확인: ${url}`)}`,
    `URL:${url}`,
    'BEGIN:VALARM',
    'TRIGGER:-P3D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(`${p.title} 신청 마감 3일 전`)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${p.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 40)}_마감.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
