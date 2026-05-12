// AuraTracker Modal Kit
// shadcn-flavored, compact, colorful icon-button friendly.
// Color tokens map to auratracker's tailwind theme (dark mode values).

const { useState } = React;

// ─────────────────────────────────────────────────────────────────────────────
// Tokens (mirror auratracker dark-mode HSL vars)
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:        "#0a0a0a",   // background
  surface:   "#171717",   // card
  panel:     "#1f1f1f",   // popover / modal
  raised:    "#262626",   // elevated row
  hover:     "#2e2e2e",
  border:    "#2a2a2a",
  borderHi:  "#3a3a3a",
  input:     "#333333",
  text:      "#fafafa",
  textDim:   "#a3a3a3",
  textFaint: "#737373",
  aura:      "#a855f7",
  auraGlow:  "#d946ef",
  money:     "#fbbf24",
  cyan:      "#22d3ee",
  pink:      "#f472b6",
  orange:    "#fb923c",
  green:     "#4ade80",
  red:       "#f87171",
  blue:      "#60a5fa",
};

// Color preset for tinted icon tiles. Each is { fg, bg, ring }
const TONE = {
  aura:    { fg: T.aura,    bg: "rgba(168,85,247,0.14)",  ring: "rgba(168,85,247,0.35)"  },
  money:   { fg: T.money,   bg: "rgba(251,191,36,0.13)",  ring: "rgba(251,191,36,0.32)"  },
  cyan:    { fg: T.cyan,    bg: "rgba(34,211,238,0.12)",  ring: "rgba(34,211,238,0.30)"  },
  pink:    { fg: T.pink,    bg: "rgba(244,114,182,0.13)", ring: "rgba(244,114,182,0.32)" },
  orange:  { fg: T.orange,  bg: "rgba(251,146,60,0.13)",  ring: "rgba(251,146,60,0.32)"  },
  green:   { fg: T.green,   bg: "rgba(74,222,128,0.13)",  ring: "rgba(74,222,128,0.32)"  },
  red:     { fg: T.red,     bg: "rgba(248,113,113,0.14)", ring: "rgba(248,113,113,0.34)" },
  blue:    { fg: T.blue,    bg: "rgba(96,165,250,0.13)",  ring: "rgba(96,165,250,0.32)"  },
  neutral: { fg: T.text,    bg: "rgba(255,255,255,0.06)", ring: "rgba(255,255,255,0.12)" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Lucide-ish inline icons (stroke-based, current color)
// ─────────────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 16, sw = 1.75, fill = "none", style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={style}>
    {d}
  </svg>
);
const I = {
  x:       <Icon d={<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>} />,
  check:   <Icon d={<path d="M20 6 9 17l-5-5"/>} />,
  alert:   <Icon d={<><path d="M12 9v4"/><path d="M12 17h.01"/><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/></>} />,
  info:    <Icon d={<><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></>} />,
  trash:   <Icon d={<><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6 17.5 20a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6"/></>} />,
  send:    <Icon d={<><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>} />,
  user:    <Icon d={<><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>} />,
  users:   <Icon d={<><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><path d="M16 4a4 4 0 0 1 0 8"/><path d="M22 21a7 7 0 0 0-5-6.7"/></>} />,
  star:    <Icon d={<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77 5.82 21l1.18-6.88L2 9.27l6.91-1.01Z"/>} />,
  sparkle: <Icon d={<><path d="m12 3 1.9 5.5L19 10l-5.1 1.5L12 17l-1.9-5.5L5 10l5.1-1.5Z"/><path d="M19 17v4"/><path d="M17 19h4"/></>} />,
  coin:    <Icon d={<><circle cx="12" cy="12" r="9"/><path d="M14.8 9.2a3 3 0 1 0 0 5.6"/><path d="M12 7v10"/></>} />,
  gift:    <Icon d={<><rect x="3" y="8" width="18" height="13" rx="1"/><path d="M12 8v13"/><path d="M19 12H5"/><path d="M7.5 8a2.5 2.5 0 1 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/></>} />,
  shield:  <Icon d={<path d="M12 2 4 5v7c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V5l-8-3Z"/>} />,
  bell:    <Icon d={<><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>} />,
  lock:    <Icon d={<><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>} />,
  volume:  <Icon d={<><path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M19 12a4 4 0 0 0-2-3.5"/><path d="M16 8.5A6 6 0 0 1 16 15.5"/></>} />,
  palette: <Icon d={<><circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 22a10 10 0 1 1 10-10 5 5 0 0 1-5 5h-2a2 2 0 0 0-1 3.7 2 2 0 0 1-1 3.3 8.5 8.5 0 0 1-1 .04"/></>} />,
  controller: <Icon d={<><path d="M17 11h.01"/><path d="M14 14h.01"/><line x1="6" x2="10" y1="11" y2="11"/><line x1="8" x2="8" y1="9" y2="13"/><path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.6 5.55.985 8.41 3.146 8.41 1.482 0 2.694-2.41 4.152-2.41h4a4 4 0 1 1 0-4h.01"/></>} />,
  trophy:  <Icon d={<><path d="M6 9a6 6 0 0 0 12 0V3H6Z"/><path d="M6 5H2a3 3 0 0 0 4 4"/><path d="M18 5h4a3 3 0 0 1-4 4"/><path d="M10 22h4"/><path d="M12 17v5"/></>} />,
  message: <Icon d={<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z"/>} />,
  flag:    <Icon d={<><path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/></>} />,
  swap:    <Icon d={<><path d="m3 7 4-4 4 4"/><path d="M7 3v18"/><path d="m21 17-4 4-4-4"/><path d="M17 21V3"/></>} />,
  arrow:   <Icon d={<><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></>} />,
  chevron: <Icon d={<path d="m9 18 6-6-6-6"/>} />,
  search:  <Icon d={<><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>} />,
  plus:    <Icon d={<><path d="M12 5v14"/><path d="M5 12h14"/></>} />,
  copy:    <Icon d={<><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>} />,
  more:    <Icon d={<><circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/></>} />,
  box:     <Icon d={<><path d="m21 8-9 4-9-4 9-4Z"/><path d="M3 8v8l9 4 9-4V8"/><path d="M12 12v9"/></>} />,
  zap:     <Icon d={<path d="M13 2 3 14h7l-1 8 10-12h-7Z"/>} />,
  block:   <Icon d={<><circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/></>} />,
  party:   <Icon d={<><path d="M5.8 11.3 2 22l10.7-3.79"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="M11.5 4.5C13 5 14 6 14.5 7.5"/><path d="M21 14c-.5-1.5-1.5-2.5-3-3"/><path d="M19 16a2 2 0 0 1 2-2"/><path d="M19 4a2 2 0 0 0-2 2"/></>} />,
};

// ─────────────────────────────────────────────────────────────────────────────
// Modal shell
// ─────────────────────────────────────────────────────────────────────────────

const Modal = ({ width = 420, children, accent }) => (
  <div style={{
    width, background: T.panel,
    border: `1px solid ${T.border}`,
    borderRadius: 16,
    boxShadow: "0 24px 60px -20px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02) inset",
    color: T.text, fontSize: 13.5, lineHeight: 1.45,
    overflow: "hidden", position: "relative",
  }}>
    {accent && (
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
        opacity: 0.8,
      }} />
    )}
    {children}
  </div>
);

const ModalHeader = ({ icon, tone = "neutral", eyebrow, title, subtitle, onClose = () => {}, compact }) => {
  const t = TONE[tone];
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 12,
      padding: compact ? "14px 14px 10px" : "16px 16px 12px",
    }}>
      {icon && (
        <div style={{
          flex: "0 0 auto",
          width: 34, height: 34, borderRadius: 10,
          background: t.bg, color: t.fg,
          display: "grid", placeItems: "center",
          boxShadow: `inset 0 0 0 1px ${t.ring}`,
        }}>
          {React.cloneElement(icon, { size: 18, sw: 2 })}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        {eyebrow && (
          <div style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: 0.5,
            color: t.fg, marginBottom: 3, textTransform: "uppercase",
          }}>{eyebrow}</div>
        )}
        <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: -0.1, color: T.text }}>
          {title}
        </div>
        {subtitle && (
          <div style={{ fontSize: 12.5, color: T.textDim, marginTop: 3 }}>
            {subtitle}
          </div>
        )}
      </div>
      <button onClick={onClose} aria-label="Close" style={{
        flex: "0 0 auto", width: 26, height: 26, borderRadius: 7,
        background: "transparent", color: T.textDim, border: 0,
        display: "grid", placeItems: "center", cursor: "pointer",
      }}
        onMouseOver={e => e.currentTarget.style.background = T.raised}
        onMouseOut={e => e.currentTarget.style.background = "transparent"}>
        {I.x}
      </button>
    </div>
  );
};

const ModalBody = ({ children, pad = "0 16px 14px" }) => (
  <div style={{ padding: pad }}>{children}</div>
);

const ModalDivider = () => (
  <div style={{ height: 1, background: T.border, margin: 0 }} />
);

const ModalFooter = ({ children, justify = "flex-end", pad }) => (
  <div style={{
    display: "flex", alignItems: "center", gap: 8,
    justifyContent: justify,
    padding: pad || "12px 14px",
    borderTop: `1px solid ${T.border}`,
    background: "rgba(255,255,255,0.015)",
  }}>{children}</div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Buttons
// ─────────────────────────────────────────────────────────────────────────────

const Button = ({ children, tone = "neutral", variant = "solid", icon, size = "md", onClick, full, style }) => {
  const t = TONE[tone];
  const heights = { sm: 28, md: 32, lg: 38 };
  const base = {
    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
    height: heights[size], padding: size === "sm" ? "0 10px" : "0 12px",
    fontSize: size === "sm" ? 12 : 12.5, fontWeight: 600,
    borderRadius: 9, cursor: "pointer", border: 0, width: full ? "100%" : "auto",
    letterSpacing: -0.05,
  };
  let look = {};
  if (variant === "solid") {
    if (tone === "neutral") look = { background: T.text, color: T.bg };
    else look = { background: t.fg, color: "#0a0a0a" };
  } else if (variant === "soft") {
    look = { background: t.bg, color: t.fg, boxShadow: `inset 0 0 0 1px ${t.ring}` };
  } else if (variant === "ghost") {
    look = { background: "transparent", color: T.textDim, boxShadow: `inset 0 0 0 1px ${T.border}` };
  } else if (variant === "outline") {
    look = { background: "transparent", color: t.fg, boxShadow: `inset 0 0 0 1px ${t.ring}` };
  }
  return (
    <button onClick={onClick} style={{ ...base, ...look, ...style }}>
      {icon && React.cloneElement(icon, { size: size === "sm" ? 13 : 14, sw: 2.2 })}
      {children}
    </button>
  );
};

const IconButton = ({ icon, label, sub, tone = "neutral", onClick }) => {
  const t = TONE[tone];
  return (
    <button onClick={onClick} style={{
      display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
      padding: 12, borderRadius: 12, background: "transparent", border: 0, cursor: "pointer",
      boxShadow: `inset 0 0 0 1px ${T.border}`, color: T.text, textAlign: "left",
      transition: "all 120ms ease",
    }}
      onMouseOver={e => { e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${t.ring}`; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
      onMouseOut={e => { e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${T.border}`; e.currentTarget.style.background = "transparent"; }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9, background: t.bg, color: t.fg,
        display: "grid", placeItems: "center", boxShadow: `inset 0 0 0 1px ${t.ring}`,
      }}>
        {React.cloneElement(icon, { size: 16, sw: 2.2 })}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{sub}</div>}
      </div>
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Rows / inputs / chips
// ─────────────────────────────────────────────────────────────────────────────

const Row = ({ icon, tone = "neutral", title, sub, meta, right, onClick, active }) => {
  const t = TONE[tone];
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 10, width: "100%",
      padding: "7px 8px", border: 0, background: active ? T.raised : "transparent",
      borderRadius: 8, cursor: onClick ? "pointer" : "default", textAlign: "left",
      color: T.text, transition: "background 120ms ease",
    }}
      onMouseOver={e => { if (onClick && !active) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
      onMouseOut={e => { if (onClick && !active) e.currentTarget.style.background = "transparent"; }}>
      {icon && (
        <div style={{
          flex: "0 0 auto", width: 26, height: 26, borderRadius: 7,
          background: t.bg, color: t.fg, display: "grid", placeItems: "center",
          boxShadow: `inset 0 0 0 1px ${t.ring}`,
        }}>
          {React.cloneElement(icon, { size: 13, sw: 2.2 })}
        </div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        {sub && <div style={{ fontSize: 11, color: T.textDim, marginTop: 1 }}>{sub}</div>}
      </div>
      {meta && <div style={{ fontSize: 11, color: T.textDim, fontVariantNumeric: "tabular-nums" }}>{meta}</div>}
      {right}
    </button>
  );
};

const Field = ({ label, value, onChange, placeholder, suffix, prefix, type = "text" }) => (
  <label style={{ display: "block" }}>
    {label && <div style={{ fontSize: 11.5, fontWeight: 500, color: T.textDim, marginBottom: 6, letterSpacing: 0.1 }}>{label}</div>}
    <div style={{
      display: "flex", alignItems: "center",
      background: T.surface, border: `1px solid ${T.input}`, borderRadius: 9,
      height: 36, padding: "0 10px", gap: 8, transition: "border-color 120ms ease",
    }}>
      {prefix && <span style={{ color: T.textDim, fontSize: 12.5 }}>{prefix}</span>}
      <input type={type} value={value} onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 0, background: "transparent", border: 0, outline: 0,
          color: T.text, fontSize: 13, fontFamily: "inherit",
        }} />
      {suffix && <span style={{ color: T.textDim, fontSize: 12 }}>{suffix}</span>}
    </div>
  </label>
);

const Chip = ({ children, tone = "neutral", active, onClick, icon }) => {
  const t = TONE[tone];
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "4px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 500,
      background: active ? t.bg : "transparent",
      color: active ? t.fg : T.textDim,
      boxShadow: `inset 0 0 0 1px ${active ? t.ring : T.border}`,
      border: 0, cursor: onClick ? "pointer" : "default",
    }}>
      {icon && React.cloneElement(icon, { size: 11, sw: 2.2 })}
      {children}
    </button>
  );
};

const Toggle = ({ on, onChange, tone = "aura" }) => {
  const t = TONE[tone];
  return (
    <button onClick={() => onChange?.(!on)} style={{
      width: 32, height: 18, borderRadius: 999, padding: 2, border: 0,
      background: on ? t.fg : T.raised, cursor: "pointer",
      transition: "background 160ms ease", flex: "0 0 auto",
    }}>
      <div style={{
        width: 14, height: 14, borderRadius: 999, background: "#fff",
        transform: `translateX(${on ? 14 : 0}px)`,
        transition: "transform 160ms ease",
      }} />
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Backdrop wrapper used in artboards (so modals show like real)
// ─────────────────────────────────────────────────────────────────────────────

const Stage = ({ children, height = 360 }) => (
  <div style={{
    width: "100%", height,
    background: `radial-gradient(120% 80% at 50% 0%, #1a1a1a 0%, ${T.bg} 60%)`,
    display: "grid", placeItems: "center", padding: 24,
    borderRadius: 14,
    boxShadow: `inset 0 0 0 1px ${T.border}`,
  }}>
    <div style={{
      position: "absolute", inset: 24, borderRadius: 12,
      backgroundImage: `linear-gradient(${T.border} 1px, transparent 1px), linear-gradient(90deg, ${T.border} 1px, transparent 1px)`,
      backgroundSize: "32px 32px",
      maskImage: "radial-gradient(closest-side, #000 30%, transparent 90%)",
      opacity: 0.5, pointerEvents: "none",
    }} />
    <div style={{ position: "relative" }}>{children}</div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Destructive confirm
// ─────────────────────────────────────────────────────────────────────────────

const DestructiveAlert = () => (
  <Stage height={300}>
    <Modal width={400} accent={T.red}>
      <ModalHeader
        icon={I.trash} tone="red"
        title="Delete this trade?"
        subtitle="The offer will be withdrawn and your items returned to inventory."
      />
      <ModalFooter>
        <Button variant="ghost">Cancel</Button>
        <Button tone="red" icon={I.trash}>Delete trade</Button>
      </ModalFooter>
    </Modal>
  </Stage>
);

// 2. Success
const SuccessAlert = () => (
  <Stage height={300}>
    <Modal width={400} accent={T.green}>
      <ModalHeader
        icon={I.check} tone="green"
        eyebrow="Trade complete"
        title="You received 2,400 aura"
        subtitle="@ironwolf sent you 2,400 ✦ aura in exchange for your Crimson Blade."
      />
      <ModalFooter>
        <Button variant="ghost">View receipt</Button>
        <Button tone="green">Nice</Button>
      </ModalFooter>
    </Modal>
  </Stage>
);

// 3. Warning
const WarningAlert = () => (
  <Stage height={300}>
    <Modal width={400} accent={T.orange}>
      <ModalHeader
        icon={I.alert} tone="orange"
        title="Leave the party?"
        subtitle="You'll forfeit your seat. The party will keep playing without you."
      />
      <ModalFooter>
        <Button variant="ghost">Stay</Button>
        <Button tone="orange" icon={I.flag}>Leave party</Button>
      </ModalFooter>
    </Modal>
  </Stage>
);

// 4. Info / unlock
const InfoAlert = () => (
  <Stage height={300}>
    <Modal width={400} accent={T.cyan}>
      <ModalHeader
        icon={I.sparkle} tone="cyan"
        eyebrow="New quest"
        title="Daily Streak — Day 4"
        subtitle="Win 3 matches before midnight to claim a bonus loot crate."
      />
      <ModalFooter>
        <Button variant="ghost">Later</Button>
        <Button tone="cyan" icon={I.arrow}>View quest</Button>
      </ModalFooter>
    </Modal>
  </Stage>
);

// ─────────────────────────────────────────────────────────────────────────────
// 5. Compact form modal — Send aura
// ─────────────────────────────────────────────────────────────────────────────

const SendAuraModal = () => {
  const [to, setTo] = useState("@thalia");
  const [amt, setAmt] = useState("420");
  return (
    <Stage height={400}>
      <Modal width={420} accent={T.aura}>
        <ModalHeader icon={I.send} tone="aura"
          title="Send aura"
          subtitle="Aura transfers are instant and irreversible." />
        <ModalBody>
          <div style={{ display: "grid", gap: 10 }}>
            <Field label="Recipient" value={to} onChange={setTo} prefix={<span style={{color:T.aura}}>@</span>} placeholder="username" />
            <Field label="Amount" value={amt} onChange={setAmt} suffix="✦ aura" type="number" />
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <Chip tone="aura" onClick={()=>setAmt("100")}>+100</Chip>
              <Chip tone="aura" onClick={()=>setAmt("500")}>+500</Chip>
              <Chip tone="aura" active onClick={()=>setAmt("1000")}>+1,000</Chip>
              <Chip tone="aura" onClick={()=>setAmt("5000")}>Max 14,210</Chip>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div style={{ flex: 1, fontSize: 11.5, color: T.textFaint }}>Fee 0.5% · arrives instantly</div>
          <Button variant="ghost">Cancel</Button>
          <Button tone="aura" icon={I.send}>Send {amt} ✦</Button>
        </ModalFooter>
      </Modal>
    </Stage>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. Action grid — Quick actions / Player menu
// ─────────────────────────────────────────────────────────────────────────────

const QuickActionsModal = () => (
  <Stage height={440}>
    <Modal width={460}>
      <ModalHeader icon={I.zap} tone="money"
        title="Quick actions"
        subtitle="Jump into something — keyboard ⌘K anywhere." />
      <ModalBody>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          <IconButton tone="aura"   icon={I.controller} label="Find a match"   sub="2.4k playing"/>
          <IconButton tone="green"  icon={I.party}      label="Start a party"  sub="Invite friends"/>
          <IconButton tone="money"  icon={I.coin}       label="Marketplace"    sub="184 listings"/>
          <IconButton tone="cyan"   icon={I.box}        label="Open crate"     sub="3 ready"/>
          <IconButton tone="pink"   icon={I.gift}       label="Daily reward"   sub="Streak ×4"/>
          <IconButton tone="orange" icon={I.trophy}     label="Leaderboard"    sub="Rank #128"/>
          <IconButton tone="blue"   icon={I.message}    label="Inbox"          sub="2 unread"/>
          <IconButton tone="red"    icon={I.shield}     label="Support"        sub="Get help"/>
          <IconButton tone="neutral" icon={I.plus}      label="More…"          sub="View all"/>
        </div>
      </ModalBody>
    </Modal>
  </Stage>
);

// ─────────────────────────────────────────────────────────────────────────────
// 7. Player profile menu (compact menu modal)
// ─────────────────────────────────────────────────────────────────────────────

const PlayerMenuModal = () => (
  <Stage height={500}>
    <Modal width={340}>
      {/* Header with avatar instead of icon tile */}
      <div style={{ padding: "16px 16px 12px", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: `conic-gradient(from 200deg, ${T.orange}, ${T.pink}, ${T.aura}, ${T.cyan}, ${T.green}, ${T.orange})`,
          padding: 2,
        }}>
          <div style={{
            width: "100%", height: "100%", borderRadius: 10, background: T.panel,
            display: "grid", placeItems: "center", color: T.text, fontWeight: 700, fontSize: 14,
          }}>IW</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            ironwolf <span style={{ fontSize: 10, color: T.aura, background: TONE.aura.bg, padding: "2px 6px", borderRadius: 999, boxShadow: `inset 0 0 0 1px ${TONE.aura.ring}` }}>LVL 47</span>
          </div>
          <div style={{ fontSize: 11.5, color: T.textDim }}>Online · in match · S2 rank Diamond</div>
        </div>
        <button style={{ width: 26, height: 26, borderRadius: 7, background: "transparent", color: T.textDim, border: 0, display:"grid", placeItems:"center", cursor:"pointer" }}>{I.more}</button>
      </div>

      <ModalDivider />
      <ModalBody pad="8px 8px">
        <Row icon={I.user}    tone="cyan"   title="View profile" sub="Bio, stats, badges" />
        <Row icon={I.message} tone="green"  title="Send message" />
        <Row icon={I.swap}    tone="money"  title="Propose trade" meta="2 pending" />
        <Row icon={I.users}   tone="pink"   title="Invite to party" />
        <Row icon={I.gift}    tone="orange" title="Send a gift" />
      </ModalBody>
      <ModalDivider />
      <ModalBody pad="8px 8px 10px">
        <Row icon={I.block} tone="red"     title="Block @ironwolf" sub="They won't see you" />
        <Row icon={I.flag}  tone="red"     title="Report player" />
      </ModalBody>
    </Modal>
  </Stage>
);

// ─────────────────────────────────────────────────────────────────────────────
// 8. Settings — complex modal with sidebar nav + subsections
// ─────────────────────────────────────────────────────────────────────────────

const SettingsModal = () => {
  const [tab, setTab] = useState("notifications");
  const [push, setPush] = useState(true);
  const [partyInv, setPartyInv] = useState(true);
  const [trade, setTrade] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const tabs = [
    { id: "profile",       label: "Profile",       icon: I.user,    tone: "cyan"  },
    { id: "notifications", label: "Notifications", icon: I.bell,    tone: "orange"},
    { id: "privacy",       label: "Privacy",       icon: I.lock,    tone: "green" },
    { id: "sounds",        label: "Sounds",        icon: I.volume,  tone: "pink"  },
    { id: "appearance",    label: "Appearance",    icon: I.palette, tone: "aura"  },
    { id: "blocked",       label: "Blocked",       icon: I.block,   tone: "red"   },
  ];
  return (
    <Stage height={560}>
      <Modal width={720} accent={T.aura}>
        <ModalHeader icon={I.shield} tone="aura"
          title="Settings"
          subtitle="Account preferences, notifications, and privacy." />
        <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", borderTop: `1px solid ${T.border}` }}>
          {/* Sidebar */}
          <div style={{ padding: 8, borderRight: `1px solid ${T.border}`, display: "grid", gap: 1 }}>
            {tabs.map(t => (
              <Row key={t.id} icon={t.icon} tone={t.tone} title={t.label}
                active={tab === t.id} onClick={() => setTab(t.id)} />
            ))}
          </div>
          {/* Content */}
          <div style={{ padding: "12px 16px 16px", display: "grid", gap: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.textFaint, letterSpacing: 0.5 }}>NOTIFICATIONS</div>

            <SettingRow icon={I.bell} tone="orange" title="Push notifications"
              sub="Receive alerts on this device." right={<Toggle on={push} onChange={setPush} tone="orange" />} />
            <SettingRow icon={I.users} tone="pink" title="Party invites"
              sub="Friends inviting you to play together." right={<Toggle on={partyInv} onChange={setPartyInv} tone="pink" />} />
            <SettingRow icon={I.swap} tone="money" title="Trade offers"
              sub="When someone proposes a trade." right={<Toggle on={trade} onChange={setTrade} tone="money" />} />
            <SettingRow icon={I.sparkle} tone="cyan" title="Quest rewards"
              sub="When daily / season rewards unlock." right={
                <select style={selectStyle()} defaultValue="all">
                  <option value="all">All</option>
                  <option>Important</option>
                  <option>None</option>
                </select>
              } />
            <SettingRow icon={I.message} tone="green" title="Marketing"
              sub="Auratracker news and product updates." right={<Toggle on={marketing} onChange={setMarketing} tone="green" />} />
          </div>
        </div>
        <ModalFooter>
          <div style={{ flex: 1, fontSize: 11.5, color: T.textFaint }}>Changes save automatically</div>
          <Button variant="ghost">Reset section</Button>
          <Button tone="aura">Done</Button>
        </ModalFooter>
      </Modal>
    </Stage>
  );
};

const SettingRow = ({ icon, tone, title, sub, right }) => {
  const t = TONE[tone];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9, background: t.bg, color: t.fg,
        display: "grid", placeItems: "center", boxShadow: `inset 0 0 0 1px ${t.ring}`, flex: "0 0 auto",
      }}>
        {React.cloneElement(icon, { size: 14, sw: 2.2 })}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{title}</div>
        {sub && <div style={{ fontSize: 11.5, color: T.textDim, marginTop: 1 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
};

const selectStyle = () => ({
  height: 28, padding: "0 8px", borderRadius: 7,
  background: T.surface, color: T.text, border: `1px solid ${T.input}`,
  fontSize: 12, fontFamily: "inherit", outline: 0, cursor: "pointer",
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. Trade — complex modal with tab menu at top
// ─────────────────────────────────────────────────────────────────────────────

const TradeModal = () => {
  const [tab, setTab] = useState("offer");
  const tabs = [
    { id: "offer",   label: "Offer",    icon: I.swap },
    { id: "items",   label: "Items",    icon: I.box, meta: "8" },
    { id: "history", label: "History",  icon: I.copy },
  ];
  return (
    <Stage height={580}>
      <Modal width={680} accent={T.money}>
        <ModalHeader icon={I.swap} tone="money"
          eyebrow="Trade with @thalia"
          title="Proposed exchange"
          subtitle="Both sides must confirm. Items lock once accepted." />

        {/* Tab strip — inline, no extra container */}
        <div style={{ display: "flex", gap: 4, padding: "0 14px 10px" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 30, padding: "0 11px", borderRadius: 8, border: 0,
              fontSize: 12.5, fontWeight: 500, cursor: "pointer",
              background: tab === t.id ? T.raised : "transparent",
              color: tab === t.id ? T.text : T.textDim,
              boxShadow: tab === t.id ? `inset 0 0 0 1px ${T.borderHi}` : "none",
            }}>
              {React.cloneElement(t.icon, { size: 13, sw: 2.2 })}
              {t.label}
              {t.meta && <span style={{
                fontSize: 10.5, color: T.money, background: TONE.money.bg,
                padding: "1px 6px", borderRadius: 999, boxShadow: `inset 0 0 0 1px ${TONE.money.ring}`,
                marginLeft: 2,
              }}>{t.meta}</span>}
            </button>
          ))}
        </div>

        <ModalDivider />

        {/* Two columns of offered items, no nested cards */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>
          <TradeSide title="You offer" badge="3 items" badgeTone="cyan" items={[
            { name: "Crimson Blade", sub: "Lvl 47 · Mythic", tone: "red", icon: I.zap },
            { name: "Phoenix Skin", sub: "Cosmetic", tone: "orange", icon: I.sparkle },
            { name: "1,200 ✦ aura", sub: "Currency", tone: "aura", icon: I.coin },
          ]} />
          <div style={{ borderLeft: `1px solid ${T.border}` }}>
            <TradeSide title="You receive" badge="2 items" badgeTone="green" items={[
              { name: "Frost Bow", sub: "Lvl 42 · Mythic", tone: "cyan", icon: I.star },
              { name: "Aurora Pet", sub: "Companion · Rare", tone: "pink", icon: I.gift },
            ]} />
          </div>
        </div>

        <ModalDivider />

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px" }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, background: TONE.green.bg, color: TONE.green.fg,
            display: "grid", placeItems: "center", boxShadow: `inset 0 0 0 1px ${TONE.green.ring}`,
          }}>{React.cloneElement(I.check, { size: 14, sw: 2.5 })}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>Estimated value match</div>
            <div style={{ fontSize: 11.5, color: T.textDim }}>You give 4,800 ✦  ·  You receive 4,650 ✦  ·  Δ −3%</div>
          </div>
          <Chip tone="green" icon={I.check} active>Fair trade</Chip>
        </div>

        <ModalFooter>
          <Button variant="ghost" icon={I.x}>Decline</Button>
          <Button tone="cyan" variant="soft" icon={I.plus}>Counter-offer</Button>
          <Button tone="money" icon={I.check}>Accept trade</Button>
        </ModalFooter>
      </Modal>
    </Stage>
  );
};

const TradeSide = ({ title, badge, badgeTone, items }) => {
  const t = TONE[badgeTone];
  return (
    <div style={{ padding: "12px 14px", display: "grid", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: T.textFaint, letterSpacing: 0.5 }}>{title.toUpperCase()}</div>
        <span style={{
          fontSize: 10.5, color: t.fg, background: t.bg,
          padding: "2px 7px", borderRadius: 999, boxShadow: `inset 0 0 0 1px ${t.ring}`,
        }}>{badge}</span>
      </div>
      {items.map((it, i) => (
        <Row key={i} icon={it.icon} tone={it.tone} title={it.name} sub={it.sub} />
      ))}
    </div>
  );
};

// Expose
Object.assign(window, {
  T, TONE, I, Icon,
  Modal, ModalHeader, ModalBody, ModalDivider, ModalFooter,
  Button, IconButton, Row, Field, Chip, Toggle, Stage,
  DestructiveAlert, SuccessAlert, WarningAlert, InfoAlert,
  SendAuraModal, QuickActionsModal, PlayerMenuModal,
  SettingsModal, TradeModal,
});
