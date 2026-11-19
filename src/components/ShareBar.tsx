import { Check, Copy, QrCode } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { copyText } from "../lib/clipboard";
import { Button, Card, Modal, cn } from "./ui";
import { useToast } from "./Toast";

export function ShareBar({
  pollId,
  className,
}: {
  pollId: string;
  className?: string;
}) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const url = `${window.location.origin}/p/${pollId}`;

  async function handleCopy() {
    const copiedOk = await copyText(url);
    if (!copiedOk) {
      toast.show("复制失败，请手动选择链接", "error");
      return;
    }
    setCopied(true);
    toast.show("链接已复制", "success");
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Card
        className={cn(
          "flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500">分享链接</p>
          <p className="mt-0.5 truncate text-sm text-slate-700">{url}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="size-4 text-emerald-600" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? "已复制" : "复制链接"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => setQrOpen(true)}
          >
            <QrCode className="size-4" />
            二维码
          </Button>
        </div>
      </Card>

      <Modal open={qrOpen} onClose={() => setQrOpen(false)} title="扫码投票">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <QRCodeSVG
              value={url}
              size={200}
              fgColor="#1e293b"
              bgColor="#ffffff"
            />
          </div>
          <p className="text-center text-xs text-slate-500">
            用手机相机或微信扫一扫
          </p>
        </div>
      </Modal>
    </>
  );
}
