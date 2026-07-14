import { type ConferenceItem } from "../types";
import { type BarcodeScannerInputHandle } from "@/components/BarcodeScannerInput";

const normalizeDigits = (value: string) => value.replace(/\D/g, "");
const normalizeIdentifier = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export const useConferenceBip = (
  conferenceItems: ConferenceItem[],
  setConferenceItems: React.Dispatch<React.SetStateAction<ConferenceItem[]>>,
  bipRef: React.RefObject<BarcodeScannerInputHandle>,
  barcodeSearch: any,
  setBipInput: (v: string) => void,
  setBipAlert: (alert: { type: "success" | "warning" | "error"; msg: string } | null) => void,
  setFlashIdx: (idx: number | null) => void,
  setBoxBipDialog: (dialog: any) => void
) => {
  const playBeep = (freq: number, duration: number) => {
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      osc.start();
      setTimeout(() => { osc.stop(); ctx.close(); }, duration);
    } catch {}
  };

  const handleBip = async (code: string) => {
    if (!code.trim()) return;
    setBipInput("");
    setBipAlert(null);

    await barcodeSearch.handleSearch(code, (result: any) => {
      const { produto, qty } = result;

      const idx = conferenceItems.findIndex(
        (i) => i.matchedProductId === produto.id || 
               (i.matchedProductBarcode && normalizeDigits(i.matchedProductBarcode) === normalizeDigits(code)) ||
               (i.matchedProductSku && normalizeIdentifier(i.matchedProductSku) === normalizeIdentifier(code))
      );

      if (idx !== -1) {
        setFlashIdx(idx);
        setTimeout(() => setFlashIdx(null), 1000);

        setConferenceItems((prev) => {
          const updated = [...prev];
          const item = { ...updated[idx] };
          item.scannedQty += qty;
          if (item.scannedQty >= item.expectedQty) {
            item.status = "ok";
            setBipAlert({ type: "success", msg: `✓ ${item.xmlProduct.description} — conferido!` });
            playBeep(800, 100);
            bipRef.current?.flash(true);
          } else {
            item.status = "partial";
            setBipAlert({ type: "success", msg: `${item.xmlProduct.description}: ${item.scannedQty}/${item.expectedQty}` });
            playBeep(600, 100);
            bipRef.current?.flash(true);
          }
          updated[idx] = item;
          return updated;
        });
        setTimeout(() => bipRef.current?.focus(), 50);
        return;
      }

      setBipAlert({ type: "error", msg: `"${produto.name}" não encontrado nesta nota.` });
      playBeep(200, 400);
      bipRef.current?.flash(false);
    });
  };

  const applyBoxBip = (productIdx: number, boxes: number, qtyPerBox: number) => {
    const total = boxes * qtyPerBox;
    setConferenceItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[productIdx] };
      item.scannedQty += total;
      item.boxBadge = `📦 ${boxes} cx × ${qtyPerBox} un = ${total}`;
      if (item.scannedQty === item.expectedQty) item.status = "ok";
      else if (item.scannedQty > item.expectedQty) item.status = "excess";
      else item.status = "partial";
      updated[productIdx] = item;
      return updated;
    });
    setBoxBipDialog(null);
    playBeep(800, 100);
    setBipAlert({ type: "success", msg: `📦 ${total} unidades adicionadas via caixa!` });
    setTimeout(() => bipRef.current?.focus(), 50);
  };

  const conferenceProgress = conferenceItems.length > 0
    ? conferenceItems.filter((i) => i.status === "ok").length
    : 0;

  return { handleBip, playBeep, applyBoxBip, conferenceProgress };
};
