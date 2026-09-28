"use client";

/*
THESIS: A fitting desk connects a specific missing piece to a complete pickup journey.
OWN-WORLD: Paper white, ink, cobalt and a pale blue portrait stage; precise Manrope type.
STORY: Start with an outfit, select one physical-style sample item, preview, reserve, collect.
FIRST VIEWPORT: A large portrait on the left, a six-piece photographic rack and actions on the right.
FORM: The atelier fitting desk defined in DESIGN.md, selected under the user's instruction to proceed.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check, CheckCircle, Clock, CoatHanger, Copy, Image as ImageIcon, Info, LockSimple, Package, Plus, ShieldCheck, Sparkle, SpinnerGap, UploadSimple, X } from "@phosphor-icons/react";

type Garment = {
  id: string; name: string; color: string; size: string; category: "outer";
  image: string; description: string; condition: string;
  measurements: { chest: number; length: number; sleeve: number };
  status: "available" | "held" | "collected"; reservationId?: string;
};
type Reservation = {
  id: string; itemId: string; itemName: string; pickupCode: string; pickupDay: string;
  status: "held" | "collected" | "released"; createdAt: string; expiresAt: string;
};
type Closet = { items: Garment[]; reservations: Reservation[]; renderCount: number };
type View = "fitting" | "desk" | "about";
type PreviewMode = "before" | "after" | "compare";
type Preview = { taskId: string; status: "processing" | "completed" | "failed"; imageUrl?: string; error?: string; source?: "saved" | "live" };

const samples = [
  { id: "alex", name: "Alex", image: "/assets/model-alex.png" },
  { id: "jordan", name: "Jordan", image: "/assets/model-jordan.png" },
];

async function responseData<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => ({ error: "The server returned an unexpected response. Please try again." }));
  if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
  return data as T;
}

function localDate(offset: number) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function pickupLabel(value: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function holdTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function ErrorNotice({ children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void }) {
  return <div className="error-notice" role="alert"><Info size={20} weight="bold" /><div>{children}</div>{onDismiss && <button className="icon-button" aria-label="Dismiss error" onClick={onDismiss}><X size={18} /></button>}</div>;
}

function Status({ status }: { status: Garment["status"] | Reservation["status"] }) {
  return <span className={`status status-${status}`}><span />{status === "available" ? "Available" : status === "held" ? "On hold" : status === "collected" ? "Collected" : "Released"}</span>;
}

export default function Home() {
  const [view, setView] = useState<View>("fitting");
  const [closet, setCloset] = useState<Closet | null>(null);
  const [closetError, setClosetError] = useState("");
  const [selectedId, setSelectedId] = useState("navy");
  const [sampleId, setSampleId] = useState("alex");
  const [upload, setUpload] = useState<File | null>(null);
  const [uploadUrl, setUploadUrl] = useState("");
  const [consent, setConsent] = useState(false);
  const [freshPreview, setFreshPreview] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("after");
  const [compare, setCompare] = useState(50);
  const [previewError, setPreviewError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [pickupDay, setPickupDay] = useState("");
  const [reservationError, setReservationError] = useState("");
  const [reservationBusy, setReservationBusy] = useState("");
  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState("");
  const uploadRef = useRef<HTMLInputElement>(null);
  const portraitRef = useRef<HTMLDivElement>(null);
  const taskStarted = useRef(0);
  const selected = closet?.items.find(item => item.id === selectedId);
  const sourceImage = uploadUrl || samples.find(sample => sample.id === sampleId)!.image;
  const busy = submitting || preview?.status === "processing";
  const activeReservations = closet?.reservations.filter(reservation => reservation.status !== "released") || [];
  const selectedReservation = activeReservations.find(reservation => reservation.itemId === selectedId);

  const loadCloset = useCallback(async () => {
    try {
      const data = await responseData<Closet>(await fetch("/api/closet", { cache: "no-store" }));
      setCloset(data);
      setClosetError("");
    } catch (error) { setClosetError(error instanceof Error ? error.message : "Your demonstration closet could not load. Please try again."); }
  }, []);

  useEffect(() => {
    void loadCloset();
    setPickupDay(localDate(0));
    const interval = setInterval(() => { void loadCloset(); }, 60000);
    return () => clearInterval(interval);
  }, [loadCloset]);

  useEffect(() => {
    if (!upload) { setUploadUrl(""); return; }
    const url = URL.createObjectURL(upload);
    setUploadUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [upload]);

  useEffect(() => {
    if (preview?.status !== "completed" || !preview.imageUrl || window.innerWidth > 720) return;
    portraitRef.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [preview?.status, preview?.imageUrl]);

  useEffect(() => {
    if (preview?.status !== "processing") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const taskId = preview.taskId;
    const poll = async () => {
      if (Date.now() - taskStarted.current > 180000) {
        if (!cancelled) { setPreview({ taskId, status: "failed" }); setPreviewError("This preview is taking longer than expected. Please try again."); }
        return;
      }
      try {
        const result = await responseData<Omit<Preview, "taskId">>(await fetch(`/api/tryon/${encodeURIComponent(taskId)}`, { cache: "no-store" }));
        if (cancelled) return;
        if (result.status === "completed" && result.imageUrl) {
          setPreview({ ...result, taskId }); setPreviewMode("after"); void loadCloset(); return;
        }
        if (result.status === "failed") {
          setPreview({ ...result, taskId }); setPreviewError(result.error || "YouCam could not create this preview. Please try a different photo."); return;
        }
        timer = setTimeout(poll, 10000);
      } catch (error) {
        if (!cancelled) { setPreview({ taskId, status: "failed" }); setPreviewError(error instanceof Error ? error.message : "We lost connection while creating your preview. Please try again."); }
      }
    };
    timer = setTimeout(poll, 3500);
    const clock = setInterval(() => setElapsed(Math.floor((Date.now() - taskStarted.current) / 1000)), 1000);
    return () => { cancelled = true; clearTimeout(timer); clearInterval(clock); };
  }, [preview?.taskId, preview?.status, loadCloset]);

  function changeView(next: View) {
    setView(next); setReservationError(""); setNotice("");
    if (next === "desk") void loadCloset();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function resetPreview() { setPreview(null); setPreviewError(""); setElapsed(0); }

  function chooseGarment(item: Garment) {
    if (busy) return;
    setSelectedId(item.id); setReserveOpen(false); setReservationError(""); resetPreview();
  }

  function chooseSample(id: string) {
    setSampleId(id); setUpload(null); setConsent(false); setFreshPreview(false); resetPreview();
    if (uploadRef.current) uploadRef.current.value = "";
  }

  function chooseUpload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setPreviewError("Please choose a JPG, PNG, or WebP photo."); return; }
    if (file.size > 4 * 1024 * 1024) { setPreviewError("This photo is too large. Choose an image under 4 MB."); return; }
    setUpload(file); setConsent(false); setFreshPreview(false); resetPreview();
  }

  async function generatePreview() {
    if (!selected || !consent || busy) return;
    setSubmitting(true); resetPreview();
    try {
      const form = new FormData();
      form.append("itemId", selected.id); form.append("consent", "true");
      if (!upload && freshPreview) form.append("live", "true");
      if (upload) form.append("image", upload); else form.append("sampleId", sampleId);
      const result = await responseData<Preview>(await fetch("/api/tryon", { method: "POST", body: form }));
      taskStarted.current = Date.now(); setElapsed(0); setPreview(result);
    } catch (error) { setPreviewError(error instanceof Error ? error.message : "The preview could not start. Please try again."); }
    finally { setSubmitting(false); }
  }

  async function reserve() {
    if (!selected || !pickupDay) return;
    setReservationBusy("new"); setReservationError("");
    try {
      await responseData<{ reservation: Reservation }>(await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ itemId: selected.id, pickupDay }) }));
      await loadCloset(); setReserveOpen(false); setNotice("Your demonstration pickup pass is ready.");
    } catch (error) { setReservationError(error instanceof Error ? error.message : "We could not hold this blazer. Please try again."); await loadCloset(); }
    finally { setReservationBusy(""); }
  }

  async function updateReservation(reservation: Reservation, action: "release" | "collect" | "return") {
    setReservationBusy(reservation.id); setReservationError(""); setNotice("");
    try {
      await responseData<{ reservation: Reservation }>(await fetch(`/api/reservations/${encodeURIComponent(reservation.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }));
      await loadCloset();
      setNotice(action === "collect" ? "Collection recorded. This sample blazer is now checked out." : action === "return" ? "Return recorded. This sample blazer is available again." : "Hold released. This sample blazer is available again.");
    } catch (error) { setReservationError(error instanceof Error ? error.message : "This action could not be completed. Please try again."); await loadCloset(); }
    finally { setReservationBusy(""); }
  }

  async function copyCode(code: string) {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    catch { setNotice(`Your pickup code is ${code}.`); }
  }

  return <>
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="site-header">
      <button className="wordmark" onClick={() => changeView("fitting")} aria-label="Readyroom fitting room"><CoatHanger size={31} weight="bold" /><span>readyroom<span className="wordmark-dot">.</span></span></button>
      <nav aria-label="Main navigation">
        <button className={view === "fitting" ? "nav-active" : ""} aria-current={view === "fitting" ? "page" : undefined} onClick={() => changeView("fitting")}>Fitting room</button>
        <button className={view === "desk" ? "nav-active" : ""} aria-current={view === "desk" ? "page" : undefined} onClick={() => changeView("desk")}>Pickup desk{activeReservations.length > 0 && <span className="nav-count">{activeReservations.length}</span>}</button>
        <button className={view === "about" ? "nav-active" : ""} aria-current={view === "about" ? "page" : undefined} onClick={() => changeView("about")}>About</button>
      </nav>
      <span className="demo-label"><span />Demo closet</span>
    </header>

    <main id="main-content" className="main-shell">
      {view === "fitting" && <>
        <section className="page-intro">
          <div><p className="eyebrow">A little more ready.</p><h1>One piece.<br /><span>A new possibility.</span></h1></div>
          <div className="intro-note"><p>Your outfit. The finishing touch.{" "}<br />Try a blazer, then hold it for pickup.</p><span><CoatHanger size={18} />A demonstration of a shared clothing closet</span></div>
        </section>

        {closetError && <ErrorNotice>{closetError} <button className="text-button" onClick={() => void loadCloset()}>Try again</button></ErrorNotice>}

        <div className="fitting-layout">
          <section className="fitting-section" aria-labelledby="fitting-heading">
            <div className="section-title"><h2 id="fitting-heading">Start with your outfit</h2><span className="step-label">01 / Your photo</span></div>
            <div className="photo-options">
              <div className="sample-choices" role="group" aria-label="Choose a sample photo">
                {samples.map(sample => <button key={sample.id} disabled={busy} aria-pressed={!upload && sampleId === sample.id} className={`sample-choice ${!upload && sampleId === sample.id ? "is-selected" : ""}`} onClick={() => chooseSample(sample.id)}><img src={sample.image} alt="" /><span>{sample.name}</span>{!upload && sampleId === sample.id && <Check size={13} weight="bold" />}</button>)}
              </div>
              <input ref={uploadRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={event => chooseUpload(event.target.files?.[0])} aria-label="Upload your outfit photo" disabled={busy} />
              <button disabled={busy} className={`upload-button ${upload ? "is-selected" : ""}`} onClick={() => uploadRef.current?.click()}><UploadSimple size={17} /><span>{upload ? "Change photo" : "Use my photo"}</span></button>
            </div>
            <div ref={portraitRef} className={`portrait-stage ${busy ? "is-processing" : ""}`}>
              <img className="portrait-image" src={preview?.imageUrl && previewMode === "after" ? preview.imageUrl : sourceImage} alt={preview?.imageUrl && previewMode === "after" ? `AI preview of ${selected?.name} over the starting outfit` : upload ? "Your uploaded starting outfit" : `Generated sample portrait of ${samples.find(sample => sample.id === sampleId)?.name}`} />
              {preview?.imageUrl && previewMode === "compare" && <><img className="portrait-image compare-result" src={preview.imageUrl} style={{ clipPath: `inset(0 ${100 - compare}% 0 0)` }} alt={`AI preview of ${selected?.name}, revealed for comparison`} /><div className="compare-divider" style={{ left: `${compare}%` }}><span><ArrowRight size={13} /><ArrowRight size={13} /></span></div><input className="compare-slider" type="range" min="0" max="100" value={compare} onChange={event => setCompare(Number(event.target.value))} aria-label="Reveal more or less of the AI preview" /></>}
              <div className="portrait-topline"><span className="photo-tag">{preview?.imageUrl && previewMode !== "before" ? <Sparkle size={14} /> : <ImageIcon size={14} />}{preview?.imageUrl && previewMode !== "before" ? preview.source === "saved" ? "Saved YouCam preview" : "Live YouCam preview" : "Original outfit"}</span><span className="photo-number">{upload ? "YOUR PHOTO" : "SAMPLE PHOTO"}</span></div>
              {!preview?.imageUrl && !busy && <div className="portrait-caption"><span>Keep what works.<br /><strong>Add what’s missing.</strong></span><ArrowDown size={23} /></div>}
              {busy && <div className="processing-note" role="status"><SpinnerGap className="spin" size={25} /><div><strong>{submitting ? "Sending your photo" : "Creating your new look"}</strong><span>{submitting ? "Getting your fitting room ready…" : `${elapsed}s · YouCam is dressing this outfit.`}</span></div></div>}
            </div>
            <div className="portrait-footer">
              {preview?.imageUrl ? <div className="comparison-controls" role="group" aria-label="Compare your outfit">{(["before", "after", "compare"] as const).map(mode => <button key={mode} aria-pressed={previewMode === mode} className={previewMode === mode ? "is-selected" : ""} onClick={() => setPreviewMode(mode)}>{mode === "before" ? "Before" : mode === "after" ? "After" : "Compare"}</button>)}</div> : <span><ShieldCheck size={16} />{upload ? "Your photo stays local until you request a preview." : "AI-generated sample photo. Try your own, too."}</span>}
              {upload && <button className="text-button" disabled={busy} onClick={() => chooseSample(sampleId)}>Remove photo</button>}
            </div>
            {preview?.imageUrl && <p className="small-note result-note">An AI styling preview, not a guarantee of fit, color, or condition. Check the actual garment in person.</p>}
          </section>

          <section className="rack-section" aria-labelledby="rack-heading">
            <div className="section-title"><h2 id="rack-heading">Find your finishing touch</h2><span className="step-label">02 / A blazer</span></div>
            <div className="rack-subtitle"><span>One-of-one pieces in this demo closet.</span><span>{closet ? `${closet.items.filter(item => item.status === "available").length} available` : "Loading rack…"}</span></div>
            <div className="garment-grid" role="group" aria-label="Choose a blazer">
              {!closet && Array.from({ length: 6 }, (_, index) => <div className="garment-skeleton" key={index}><div /><span /></div>)}
              {closet?.items.map(item => <button key={item.id} className={`garment-card ${selectedId === item.id ? "is-selected" : ""}`} aria-pressed={selectedId === item.id} disabled={busy} onClick={() => chooseGarment(item)}><div className="garment-photo"><img src={item.image} alt={`${item.color} ${item.name}`} />{selectedId === item.id && <span className="selection-mark"><Check weight="bold" size={15} /></span>}{item.status !== "available" && <span className="garment-state">{item.status === "held" ? "On hold" : "Collected"}</span>}</div><div className="garment-name"><span>{item.name}</span><span>{item.size}</span></div></button>)}
            </div>
            {closet && closet.items.length === 0 && <div className="empty-rack"><CoatHanger size={32} /><p>This closet is empty right now.</p><button className="text-button" onClick={() => void loadCloset()}>Refresh rack</button></div>}
            {selected && <div className="selected-details">
              <div className="selected-heading"><div><span className="detail-eyebrow">Your selected piece</span><h3>{selected.name}</h3></div><Status status={selected.status} /></div>
              <p className="garment-description">{selected.description}</p>
              <div className="garment-facts"><div><span>Size</span><strong>{selected.size}</strong></div><div><span>Color</span><strong>{selected.color}</strong></div><div><span>Condition</span><strong>{selected.condition}</strong></div></div>
              <details className="measurements"><summary>Sample measurements <Plus size={16} /></summary><div><span>Chest <strong>{selected.measurements.chest} cm</strong></span><span>Length <strong>{selected.measurements.length} cm</strong></span><span>Sleeve <strong>{selected.measurements.sleeve} cm</strong></span></div><p>Illustrative measurements for this demonstration. Virtual try-on does not establish size or fit.</p></details>
              <label className="consent-row"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} disabled={busy} /><span>{upload ? "I have permission to use this photo and agree to send it to Perfect Corp (YouCam) for this preview." : "I agree to use this sample photo for a Perfect Corp (YouCam) preview."}</span></label>
              {!upload && <div className="sample-render-choice"><label><input type="checkbox" checked={freshPreview} onChange={event => setFreshPreview(event.target.checked)} disabled={busy} /><span>Generate a fresh preview</span></label><p>{freshPreview ? "YouCam will process this sample photo again. This may take a minute." : "Sample previews reuse results previously generated by YouCam, when available."}</p></div>}
              {previewError && <ErrorNotice onDismiss={() => setPreviewError("")}>{previewError}</ErrorNotice>}
              <button className="button button-primary preview-button" disabled={!consent || busy} onClick={() => void generatePreview()}>{busy ? <SpinnerGap className="spin" size={21} /> : <Sparkle size={21} weight="fill" />}<span>{busy ? "Creating your preview…" : preview?.imageUrl ? "Create another preview" : "Preview this blazer"}</span>{!busy && <ArrowRight size={19} />}</button>
              {!consent && <p className="consent-hint">Check the box above to start your preview.</p>}

              {selectedReservation ? <div className="inline-pass"><CheckCircle size={23} weight="fill" /><div><strong>{selectedReservation.status === "held" ? "Your pickup pass is ready" : "This blazer is checked out"}</strong><span>{selectedReservation.pickupCode} · {pickupLabel(selectedReservation.pickupDay)}</span></div><button className="text-button" onClick={() => changeView("desk")}>View pass <ArrowRight size={15} /></button></div> : selected.status === "available" ? <>
                {!reserveOpen ? <button className="button button-secondary reserve-button" onClick={() => { setReserveOpen(true); setReservationError(""); }}><CoatHanger size={20} /><span>Hold for pickup</span><ArrowRight size={18} /></button> : <div className="reserve-form"><div className="reserve-form-heading"><h4>Make a little room for it.</h4><button className="icon-button" aria-label="Cancel reservation" onClick={() => setReserveOpen(false)}><X size={18} /></button></div><label htmlFor="pickup-day">Choose a demonstration pickup day</label><select id="pickup-day" value={pickupDay} onChange={event => setPickupDay(event.target.value)}>{[0, 1, 2].map(offset => <option value={localDate(offset)} key={offset}>{offset === 0 ? "Today" : offset === 1 ? "Tomorrow" : "In two days"} · {pickupLabel(localDate(offset))}</option>)}</select><p><Clock size={15} />Demo holds expire after 15 minutes.</p><button className="button button-primary" onClick={() => void reserve()} disabled={reservationBusy === "new"}>{reservationBusy === "new" ? <SpinnerGap className="spin" size={19} /> : <Check size={19} />}Confirm demo hold</button></div>}
              </> : <p className="unavailable-note">This piece is {selected.status === "held" ? "on hold" : "checked out"}. Choose another blazer to reserve.</p>}
              {reservationError && <ErrorNotice>{reservationError}</ErrorNotice>}
              <p className="demo-disclosure">Sample inventory · No payment · No physical pickup</p>
            </div>}
          </section>
        </div>
        <div className="how-strip"><p><span>From “almost” to ready.</span> Try the look. Hold the piece. Bring it full circle.</p><button className="text-button" onClick={() => changeView("about")}>The idea behind Readyroom <ArrowUpRight size={17} /></button></div>
      </>}

      {view === "desk" && <>
        <section className="page-intro desk-intro"><div><p className="eyebrow">The next step.</p><h1>Ready when<br /><span>you are.</span></h1></div><div className="intro-note"><p>Your holds, pickups, and returns.{" "}<br />All in one little place.</p><span><LockSimple size={17} />Only this browser’s demonstration closet</span></div></section>
        <div className="desk-demo-notice"><Info size={20} /><p><strong>You’re behind the demonstration pickup desk.</strong> Try collecting, releasing, or returning a piece. These actions update your own sample inventory. No physical pickup is arranged.</p></div>
        {closetError && <ErrorNotice>{closetError} <button className="text-button" onClick={() => void loadCloset()}>Try again</button></ErrorNotice>}
        {reservationError && <ErrorNotice onDismiss={() => setReservationError("")}>{reservationError}</ErrorNotice>}
        {notice && <div className="success-notice" role="status"><CheckCircle size={20} weight="fill" />{notice}</div>}
        <div className="desk-title"><h2>Your pickup passes</h2><span>{activeReservations.length} active {activeReservations.length === 1 ? "pass" : "passes"}</span></div>
        {!closet && !closetError && <div className="desk-empty"><SpinnerGap className="spin" size={35} /><h3>Opening your pickup desk…</h3></div>}
        {closet && activeReservations.length === 0 && <div className="desk-empty"><CoatHanger size={57} weight="light" /><h3>A piece of possibility<br />is waiting on the rack.</h3><p>Choose a blazer and hold it to get your first demonstration pickup pass.</p><button className="button button-primary" onClick={() => changeView("fitting")}>Find your piece <ArrowRight size={18} /></button></div>}
        <div className="pickup-passes">{activeReservations.map(reservation => {
          const item = closet?.items.find(candidate => candidate.id === reservation.itemId);
          return <article className="pickup-pass" key={reservation.id}><div className="pass-main"><div className="pass-image"><img src={item?.image} alt={reservation.itemName} /></div><div className="pass-details"><Status status={reservation.status} /><h3>{reservation.itemName}</h3><p>{item?.color} · Size {item?.size}</p><div className="pass-meta"><span>Demo pickup day<strong>{pickupLabel(reservation.pickupDay)}</strong></span><span>{reservation.status === "held" ? "Hold expires" : "Status"}<strong>{reservation.status === "held" ? holdTime(reservation.expiresAt) : "Checked out"}</strong></span></div></div></div><div className="pass-stub"><span className="detail-eyebrow">Your pickup code</span><div className="pickup-code">{reservation.pickupCode}<button className="icon-button" aria-label={`Copy pickup code ${reservation.pickupCode}`} onClick={() => void copyCode(reservation.pickupCode)}>{copied ? <Check size={19} /> : <Copy size={19} />}</button></div><p>Demonstration pass · No physical inventory</p><div className="pass-actions">{reservation.status === "held" ? <><button className="button button-primary" disabled={!!reservationBusy} onClick={() => void updateReservation(reservation, "collect")}>{reservationBusy === reservation.id ? <SpinnerGap className="spin" size={18} /> : <Package size={18} />}Mark collected</button><button className="text-button" disabled={!!reservationBusy} onClick={() => void updateReservation(reservation, "release")}>Release hold</button></> : <button className="button button-secondary" disabled={!!reservationBusy} onClick={() => void updateReservation(reservation, "return")}>{reservationBusy === reservation.id ? <SpinnerGap className="spin" size={18} /> : <CoatHanger size={18} />}Record return</button>}</div></div></article>;
        })}</div>
        {closet && closet.reservations.some(reservation => reservation.status === "released") && <div className="history-section"><h2>Back on the rack</h2><p>Released holds and returned pieces are available to try again.</p>{closet.reservations.filter(reservation => reservation.status === "released").map(reservation => <div className="history-row" key={reservation.id}><span>{reservation.itemName}</span><span>{reservation.pickupCode}</span><Status status="released" /></div>)}</div>}
      </>}

      {view === "about" && <>
        <section className="about-hero"><p className="eyebrow">The idea behind Readyroom</p><h1>Your next chapter.<br /><span>Already in the closet.</span></h1><p className="about-lead">Sometimes getting ready for an interview starts with one missing piece. Readyroom connects a virtual fitting room to a shared clothing closet, so a good possibility has a practical next step.</p><button className="button button-primary" onClick={() => changeView("fitting")}>Step into the fitting room <ArrowRight size={20} /></button></section>
        <div className="about-spread"><div className="about-photo"><img src="/assets/model-jordan.png" alt="AI-generated demonstration portrait of Jordan in their starting outfit" /><span>Generated demonstration photograph</span></div><div className="about-story"><h2>A preview is just<br />the beginning.</h2><p>A virtual look is useful. Being able to act on it is better. Every blazer here is a specific sample inventory item with its own size, condition, availability, and pickup pass.</p><div className="journey-item"><span>01</span><div><h3>Start with what you have.</h3><p>Choose a sample portrait or bring a photo of your outfit.</p></div></div><div className="journey-item"><span>02</span><div><h3>See one new possibility.</h3><p>YouCam creates a visual preview using your selected blazer. Compare it with the original outfit.</p></div></div><div className="journey-item"><span>03</span><div><h3>Take the next step.</h3><p>Hold the piece, collect it at the demo desk, and return it to the rack.</p></div></div></div></div>
        <div className="about-boundaries"><h2>A real workflow.<br />A clearly labeled demonstration.</h2><div><p>This prototype uses generated sample photographs and illustrative garments. It is not affiliated with a university, clothing closet, or donation partner, and no physical items are available.</p><p>The preview is powered by YouCam. It suggests how a garment might look; it cannot verify fit, fabric, condition, or exact color. Your photo is sent for processing only after you choose to create a preview and provide consent.</p><p>No name, email, or payment is needed. Your demo closet is separate from other visitors’ closets. Holds expire after 15 minutes, so you can explore the full journey.</p></div></div>
      </>}
    </main>
    <footer className="site-footer"><span>readyroom.</span><p>One piece. A new possibility.</p><span className="footer-note">Virtual try-on powered by YouCam</span></footer>
    <div className="sr-only" aria-live="polite">{copied ? "Pickup code copied." : ""}</div>
    <div className="sr-only" role="status" aria-live="polite">{preview?.status === "completed" && preview.imageUrl ? `Your ${preview.source === "saved" ? "saved" : "live"} YouCam preview is ready. Use Before, After, or Compare below the photo to explore the result.` : ""}</div>
  </>;
}
