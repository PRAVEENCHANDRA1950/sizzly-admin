import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, Download, ExternalLink, Printer } from 'lucide-react';
import { tableQrUrl } from '../lib/firebase';
import { useToast } from '../context/ToastContext';
import { Button, Modal } from './ui';
import type { RestaurantTable } from '../types';

export function TableQrModal({
  table,
  onClose,
}: {
  table: RestaurantTable | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const wrapRef = useRef<HTMLDivElement>(null);
  if (!table) return null;

  const url = tableQrUrl(table.id);
  const title = table.name || `Table ${table.id}`;
  const canvas = () => wrapRef.current?.querySelector('canvas') ?? null;

  function download() {
    const c = canvas();
    if (!c) return;
    const link = document.createElement('a');
    link.href = c.toDataURL('image/png');
    link.download = `sizzly-qr-${table!.id}.png`;
    link.click();
  }

  function print() {
    const c = canvas();
    if (!c) return;
    const safeTitle = title.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
    const win = window.open('', '_blank', 'width=480,height=640');
    if (!win) {
      toast.error('Allow pop-ups to print the QR code.');
      return;
    }
    win.document.write(`<!doctype html><html><head><title>${safeTitle}</title>
      <style>body{font-family:Inter,Arial,sans-serif;text-align:center;padding:40px;color:#1A1A1A}
      h1{margin:0 0 4px;font-size:28px}p{margin:0 0 24px;color:#666}img{width:300px;height:300px}
      .brand{margin-top:24px;font-weight:700;color:#FF6B00}</style></head><body>
      <h1>${safeTitle}</h1><p>Scan to view the menu &amp; order</p>
      <img src="${c.toDataURL('image/png')}" alt="QR code" />
      <div class="brand">Sizzly Chicken</div>
      <script>window.onload=function(){window.print();}</script></body></html>`);
    win.document.close();
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied.');
    } catch {
      toast.error('Could not copy. Select the link and copy it manually.');
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={`QR code · ${title}`}
      footer={
        <>
          <Button variant="secondary" icon={<Printer className="h-4 w-4" />} onClick={print}>
            Print
          </Button>
          <Button icon={<Download className="h-4 w-4" />} onClick={download}>
            Download PNG
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <div ref={wrapRef} className="rounded-2xl border border-gray-200 bg-white p-4">
          <QRCodeCanvas value={url} size={240} level="M" marginSize={2} />
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Guests scan this to open the menu for <span className="font-semibold text-ink">{title}</span>.
        </p>
        <div className="mt-3 flex w-full items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-left">
          <code className="flex-1 truncate text-xs text-gray-600">{url}</code>
          <button onClick={copy} className="rounded p-1 text-gray-500 hover:text-ink" aria-label="Copy link">
            <Copy className="h-4 w-4" />
          </button>
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="rounded p-1 text-gray-500 hover:text-ink"
            aria-label="Open link"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>
      </div>
    </Modal>
  );
}
