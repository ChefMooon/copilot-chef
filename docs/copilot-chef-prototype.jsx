import { useState, useRef, useEffect } from "react";

const NAV_ITEMS = ["Home", "Calendar", "Meal Plan", "Grocery List"];

const QUICK_PROMPTS = [
  { label: "Plan this week", icon: "📅" },
  { label: "New grocery list", icon: "🛒" },
  { label: "Suggest a dinner", icon: "🍽️" },
  { label: "Add a meal", icon: "➕" },
  { label: "What's in season?", icon: "🌿" },
  { label: "Surprise me!", icon: "🎲" },
];

const INITIAL_MESSAGES = [
  {
    role: "assistant",
    text: "Hey Chef! 👋 I'm your Copilot. Ask me to plan meals, build a grocery list, suggest recipes, or swap out anything on your plan.",
  },
];

// 13 weeks of data (~3 months), columns = weeks, rows = days Mon–Sun
const TODAY = new Date(2026, 2, 12);
const generateHeatmap = () => {
  const start = new Date(TODAY);
  start.setDate(TODAY.getDate() - 13 * 7 + 1);
  const dow = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - dow);

  const weeks = [];
  for (let w = 0; w < 13; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      const isFuture = date > TODAY;
      const meals = isFuture ? -1 : Math.random() < 0.15 ? 0 : Math.floor(Math.random() * 3) + 1;
      week.push({ date, meals, isFuture });
    }
    weeks.push(week);
  }
  return weeks;
};
const HEATMAP = generateHeatmap();
// month label: which week index each new month starts at
const MONTH_STARTS = (() => {
  const seen = {};
  HEATMAP.forEach((week, wi) => {
    const mo = week[0].date.toLocaleString("default", { month: "short" });
    if (!seen[mo]) seen[mo] = wi;
  });
  return seen;
})();

const GROCERY_ITEMS = [
  { name: "Whole chicken", checked: false },
  { name: "Butternut squash", checked: true },
  { name: "Arborio rice", checked: false },
  { name: "Fresh thyme & rosemary", checked: false },
  { name: "Coconut milk", checked: true },
  { name: "Sourdough starter", checked: false },
  { name: "Parmesan block", checked: true },
  { name: "Fish fillets", checked: false },
];

export default function CopilotChef() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState("Home");
  const [groceries] = useState(GROCERY_ITEMS);
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [chatInput, setChatInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [tooltip, setTooltip] = useState(null);
  const messagesEndRef = useRef(null);

  const checkedCount = groceries.filter((g) => g.checked).length;
  const groceryPct = Math.round((checkedCount / groceries.length) * 100);

  const sendMessage = (text) => {
    const msg = text || chatInput.trim();
    if (!msg) return;
    setChatInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setIsTyping(true);
    setTimeout(() => {
      setIsTyping(false);
      setMessages((m) => [...m, {
        role: "assistant",
        text: "Great idea! I'll get on that. In the real app I'd use the Copilot SDK to plan your meals, generate grocery lists, and more. 🍽️",
      }]);
    }, 1400);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const heatColor = (meals, isFuture) => {
    if (isFuture) return "var(--cream-dark)";
    if (meals === 0) return "#E4DDD0";
    if (meals === 1) return "#A8C8B0";
    if (meals === 2) return "#6FA882";
    return "var(--green)";
  };

  return (
    <div style={{ fontFamily: "'Lora', Georgia, serif", background: "#F5F0E8", minHeight: "100vh", color: "#2C2416" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        :root {
          --green: #3B5E45;
          --green-light: #5A7D63;
          --green-pale: #D4E4D8;
          --cream: #F5F0E8;
          --cream-dark: #EDE6D6;
          --orange: #C5622A;
          --orange-light: #E8885A;
          --text: #2C2416;
          --text-muted: #7A6A58;
          --white: #FFFDF8;
          --shadow: 0 2px 12px rgba(44,36,22,0.10);
          --shadow-lg: 0 6px 28px rgba(44,36,22,0.14);
        }

        /* HEADER */
        .header {
          background: var(--green); padding: 0 2rem; height: 64px;
          display: flex; align-items: center; justify-content: space-between;
          position: sticky; top: 0; z-index: 100;
          box-shadow: 0 2px 16px rgba(44,36,22,0.18);
        }
        .logo {
          font-family: 'Lora', serif; font-size: 1.45rem; font-weight: 700;
          color: #FFFDF8; display: flex; align-items: center; gap: 0.5rem;
        }
        .nav-desktop { display: flex; gap: 0.25rem; align-items: center; }
        .nav-link {
          font-family: 'Nunito', sans-serif; font-size: 0.9rem; font-weight: 600;
          color: rgba(255,253,248,0.75); padding: 0.45rem 1rem; border-radius: 8px;
          cursor: pointer; transition: all 0.18s; border: none; background: none;
        }
        .nav-link:hover { color: #FFFDF8; background: rgba(255,253,248,0.1); }
        .nav-link.active { color: #FFFDF8; background: rgba(255,253,248,0.18); }
        .nav-right { display: flex; align-items: center; gap: 0.5rem; }
        .settings-btn {
          width: 38px; height: 38px; border-radius: 50%;
          background: rgba(255,253,248,0.12); border: none; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.1rem; transition: background 0.18s; color: #FFFDF8;
        }
        .settings-btn:hover { background: rgba(255,253,248,0.22); }
        .hamburger {
          display: none; width: 38px; height: 38px; border-radius: 8px;
          background: rgba(255,253,248,0.12); border: none; cursor: pointer;
          align-items: center; justify-content: center;
          flex-direction: column; gap: 5px; padding: 10px;
        }
        .hamburger span { display: block; width: 18px; height: 2px; background: #FFFDF8; border-radius: 2px; }
        .mobile-menu {
          display: none; position: fixed; top: 64px; left: 0; right: 0;
          background: var(--green); padding: 1rem; z-index: 99;
          box-shadow: var(--shadow-lg); flex-direction: column; gap: 0.25rem;
          border-bottom: 3px solid var(--orange);
        }
        .mobile-menu.open { display: flex; }
        .mobile-nav-link {
          font-family: 'Nunito', sans-serif; font-size: 1rem; font-weight: 600;
          color: rgba(255,253,248,0.85); padding: 0.75rem 1rem; border-radius: 8px;
          cursor: pointer; border: none; background: none; text-align: left; transition: all 0.15s;
        }
        .mobile-nav-link:hover, .mobile-nav-link.active { background: rgba(255,253,248,0.12); color: #FFFDF8; }

        /* PAGE */
        .page { max-width: 1200px; margin: 0 auto; padding: 2rem 2rem 4rem; }
        .page-greeting { margin-bottom: 1.5rem; }
        .greeting-eyebrow {
          font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; color: var(--orange); margin-bottom: 0.3rem;
        }
        .greeting-title { font-family: 'Lora', serif; font-size: 2rem; font-weight: 700; line-height: 1.2; }
        .greeting-sub { font-family: 'Nunito', sans-serif; font-size: 0.95rem; color: var(--text-muted); margin-top: 0.35rem; }

        /* CHAT BOX — 3-col grid, tall */
        .chat-box {
          background: var(--white);
          border-radius: 18px;
          box-shadow: var(--shadow-lg);
          border: 1px solid rgba(59,94,69,0.10);
          display: grid;
          grid-template-columns: 148px 1fr 185px;
          grid-template-rows: 1fr auto;
          height: 460px;
          overflow: hidden;
          margin-bottom: 1.25rem;
        }

        /* Brand bar — spans both rows, left col */
        .chat-brand {
          background: var(--green);
          grid-column: 1; grid-row: 1 / 3;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          gap: 0.6rem; padding: 1.5rem 1rem;
          border-radius: 18px 0 0 18px;
        }
        .chat-avatar {
          width: 46px; height: 46px; background: var(--orange);
          border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.35rem;
        }
        .chat-brand-name { font-family: 'Lora', serif; font-size: 0.88rem; font-weight: 700; color: #FFFDF8; text-align: center; line-height: 1.3; }
        .chat-brand-sub { font-family: 'Nunito', sans-serif; font-size: 0.64rem; color: rgba(255,253,248,0.6); text-align: center; font-weight: 600; }
        .chat-online { width: 8px; height: 8px; background: #7ECBA1; border-radius: 50%; box-shadow: 0 0 0 2px rgba(126,203,161,0.3); margin-top: 0.2rem; }

        /* Message thread — middle col, row 1 */
        .chat-messages {
          grid-column: 2; grid-row: 1;
          overflow-y: auto; padding: 1rem 1rem 0.5rem;
          display: flex; flex-direction: column; gap: 0.65rem;
          border-left: 1px solid var(--cream-dark);
        }
        .chat-messages::-webkit-scrollbar { width: 3px; }
        .chat-messages::-webkit-scrollbar-thumb { background: var(--cream-dark); border-radius: 3px; }
        .chat-bubble {
          max-width: 88%; padding: 0.6rem 0.85rem; border-radius: 14px;
          font-family: 'Nunito', sans-serif; font-size: 0.85rem; font-weight: 500; line-height: 1.45;
          animation: bubbleIn 0.2s ease both;
        }
        @keyframes bubbleIn { from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
        .chat-bubble.assistant {
          background: var(--cream); color: var(--text);
          border-bottom-left-radius: 4px; align-self: flex-start; border: 1px solid var(--cream-dark);
        }
        .chat-bubble.user { background: var(--green); color: #FFFDF8; border-bottom-right-radius: 4px; align-self: flex-end; }
        .typing-indicator {
          display: flex; gap: 4px; align-items: center; padding: 0.6rem 0.85rem;
          background: var(--cream); border: 1px solid var(--cream-dark);
          border-radius: 14px; border-bottom-left-radius: 4px; align-self: flex-start; width: fit-content;
        }
        .typing-dot { width: 6px; height: 6px; background: var(--text-muted); border-radius: 50%; animation: bounce 1.2s infinite ease-in-out; }
        .typing-dot:nth-child(2) { animation-delay: 0.18s; }
        .typing-dot:nth-child(3) { animation-delay: 0.36s; }
        @keyframes bounce { 0%,80%,100% { transform:translateY(0); opacity:0.5; } 40% { transform:translateY(-5px); opacity:1; } }

        /* Input bar — middle col, row 2 */
        .chat-input-row {
          grid-column: 2; grid-row: 2;
          display: flex; gap: 0.5rem; align-items: center;
          padding: 0.6rem 1rem 0.8rem;
          border-top: 1px solid var(--cream-dark);
          border-left: 1px solid var(--cream-dark);
        }
        .chat-input {
          flex: 1; font-family: 'Nunito', sans-serif; font-size: 0.88rem; font-weight: 500;
          color: var(--text); background: var(--cream); border: 1.5px solid var(--cream-dark);
          border-radius: 10px; padding: 0.55rem 0.8rem; outline: none; resize: none;
          transition: border-color 0.15s; min-height: 38px; max-height: 80px;
        }
        .chat-input:focus { border-color: var(--green-light); }
        .chat-input::placeholder { color: var(--text-muted); }
        .chat-send-btn {
          width: 38px; height: 38px; background: var(--orange); border: none;
          border-radius: 10px; cursor: pointer; display: flex; align-items: center;
          justify-content: center; font-size: 0.95rem; flex-shrink: 0; transition: all 0.15s;
        }
        .chat-send-btn:hover { background: var(--orange-light); transform: scale(1.05); }

        /* Quick Prompts — right col, spans both rows, desktop only */
        .quick-prompts-col {
          grid-column: 3; grid-row: 1 / 3;
          border-left: 1px solid var(--cream-dark);
          display: flex; flex-direction: column;
          padding: 1rem 0.9rem; gap: 0.45rem; overflow-y: auto;
        }
        .qp-label {
          font-family: 'Nunito', sans-serif; font-size: 0.65rem; font-weight: 800;
          letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.25rem;
        }
        .qp-btn {
          display: flex; align-items: center; gap: 0.5rem;
          font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 700;
          color: var(--text); background: var(--cream);
          border: 1px solid var(--cream-dark); border-radius: 10px;
          padding: 0.5rem 0.7rem; cursor: pointer; text-align: left;
          transition: all 0.15s; line-height: 1.3;
        }
        .qp-btn:hover { background: var(--green-pale); border-color: var(--green-light); color: var(--green); }
        .qp-icon { font-size: 1rem; flex-shrink: 0; }

        /* SECTION DIVIDER */
        .section-divider {
          font-family: 'Nunito', sans-serif; font-size: 0.72rem; font-weight: 800;
          letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-muted);
          margin: 1.25rem 0 0.8rem; display: flex; align-items: center; gap: 0.75rem;
        }
        .section-divider::after { content: ''; flex: 1; height: 1px; background: var(--cream-dark); }

        /* CARDS */
        .grid-2 { display: grid; grid-template-columns: auto 1fr; gap: 1.25rem; }
        .card {
          background: var(--white); border-radius: 16px; padding: 1.1rem 1.25rem;
          box-shadow: var(--shadow); border: 1px solid rgba(59,94,69,0.08);
        }
        .card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
        .card-title { font-family: 'Lora', serif; font-size: 1rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; }
        .card-action { font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 700; color: var(--green); cursor: pointer; opacity: 0.8; text-decoration: none; }
        .card-action:hover { opacity: 1; text-decoration: underline; }

        /* HEATMAP */
        .heatmap-wrap { width: fit-content; }
        .heatmap-month-row {
          display: grid;
          grid-template-columns: 18px repeat(13, 12px);
          gap: 3px;
          margin-bottom: 2px;
        }
        .hm-mo-cell {
          font-family: 'Nunito', sans-serif; font-size: 0.58rem; font-weight: 700;
          color: var(--text-muted); white-space: nowrap;
        }
        .heatmap-grid {
          display: grid;
          grid-template-columns: 18px repeat(13, 12px);
          grid-template-rows: repeat(7, 12px);
          gap: 3px;
        }
        .hm-day-label {
          font-family: 'Nunito', sans-serif; font-size: 0.55rem; font-weight: 700;
          color: var(--text-muted); display: flex; align-items: center;
          justify-content: flex-end; padding-right: 2px;
        }
        .hm-sq {
          width: 12px; height: 12px;
          border-radius: 2px; cursor: default;
          transition: transform 0.1s;
        }
        .hm-sq:hover { transform: scale(1.4); z-index: 2; }
        .heatmap-legend {
          display: flex; align-items: center;
          gap: 3px; margin-top: 8px;
        }
        .hm-leg-lbl { font-family: 'Nunito', sans-serif; font-size: 0.58rem; font-weight: 600; color: var(--text-muted); }
        .hm-leg-sq { width: 10px; height: 10px; border-radius: 2px; flex-shrink: 0; }

        /* GROCERY SUMMARY */
        .grocery-summary { display: flex; flex-direction: column; gap: 0.75rem; }
        .grocery-list-name { font-family: 'Lora', serif; font-size: 0.92rem; font-weight: 600; color: var(--text); }
        .grocery-list-meta { font-family: 'Nunito', sans-serif; font-size: 0.73rem; font-weight: 500; color: var(--text-muted); margin-top: 0.15rem; }
        .grocery-stat-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.4rem; }
        .grocery-stat-big { font-family: 'Lora', serif; font-size: 2rem; font-weight: 700; color: var(--green); line-height: 1; }
        .grocery-stat-label { font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 600; color: var(--text-muted); margin-left: 0.35rem; }
        .grocery-pct { font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 700; color: var(--text-muted); }
        .progress-bar-bg { height: 8px; background: var(--cream-dark); border-radius: 99px; overflow: hidden; }
        .progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--green), #6FA882); border-radius: 99px; transition: width 0.5s ease; }
        .grocery-go-btn {
          font-family: 'Nunito', sans-serif; font-size: 0.78rem; font-weight: 700;
          color: #FFFDF8; background: var(--orange); border: none; border-radius: 10px;
          padding: 0.45rem 0.95rem; cursor: pointer; transition: all 0.15s; align-self: flex-start;
        }
        .grocery-go-btn:hover { background: var(--orange-light); }

        /* TOOLTIP */
        .heat-tooltip {
          position: fixed; background: var(--text); color: #FFFDF8;
          font-family: 'Nunito', sans-serif; font-size: 0.72rem; font-weight: 600;
          padding: 4px 10px; border-radius: 6px; pointer-events: none;
          z-index: 9999; white-space: nowrap; transform: translate(-50%, calc(-100% - 8px));
        }

        /* RESPONSIVE */
        @media (max-width: 900px) {
          .chat-box {
            grid-template-columns: 148px 1fr;
            grid-template-rows: 1fr auto;
          }
          .quick-prompts-col { display: none; }
          .chat-input-row { grid-column: 2; }
        }
        @media (max-width: 600px) {
          .chat-box {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr auto;
            height: auto;
          }
          .chat-brand {
            flex-direction: row; border-radius: 18px 18px 0 0;
            grid-column: 1; grid-row: 1; padding: 0.85rem 1.25rem; gap: 0.75rem; justify-content: flex-start;
          }
          .chat-brand-sub, .chat-online { display: none; }
          .chat-messages { grid-column: 1; grid-row: 2; height: 200px; border-left: none; border-top: 1px solid var(--cream-dark); }
          .chat-input-row { grid-column: 1; grid-row: 3; border-left: none; }
        }
        @media (max-width: 768px) {
          .nav-desktop { display: none; }
          .hamburger { display: flex; }
          .page { padding: 1.25rem 1rem 3rem; }
          .grid-2 { grid-template-columns: 1fr; }
          .greeting-title { font-size: 1.55rem; }
        }
        @media (max-width: 480px) { .header { padding: 0 1rem; } .logo { font-size: 1.2rem; } }

        .fade-in { animation: fadeUp 0.38s ease both; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-in:nth-child(1) { animation-delay: 0.04s; }
        .fade-in:nth-child(2) { animation-delay: 0.09s; }
        .fade-in:nth-child(3) { animation-delay: 0.14s; }
        .fade-in:nth-child(4) { animation-delay: 0.19s; }
      `}</style>

      {/* HEADER */}
      <header className="header">
        <div className="logo"><span style={{ fontSize: "1.5rem" }}>🍳</span>Copilot Chef</div>
        <nav className="nav-desktop">
          {NAV_ITEMS.map((item) => (
            <button key={item} className={`nav-link ${activePage === item ? "active" : ""}`}
              onClick={() => setActivePage(item)}>{item}</button>
          ))}
        </nav>
        <div className="nav-right">
          <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
            <span /><span /><span />
          </button>
          <button className="settings-btn" title="Settings">⚙️</button>
        </div>
      </header>

      {/* MOBILE MENU */}
      <div className={`mobile-menu ${menuOpen ? "open" : ""}`}>
        {NAV_ITEMS.map((item) => (
          <button key={item} className={`mobile-nav-link ${activePage === item ? "active" : ""}`}
            onClick={() => { setActivePage(item); setMenuOpen(false); }}>{item}</button>
        ))}
      </div>

      {/* PAGE */}
      <main className="page">

        <div className="page-greeting fade-in">
          <div className="greeting-eyebrow">Thursday, March 12</div>
          <h1 className="greeting-title">Good morning, Chef! 👋</h1>
          <p className="greeting-sub">You have 7 meals planned this week. Let's get cooking.</p>
        </div>

        {/* CHAT */}
        <div className="chat-box fade-in">
          {/* Brand col */}
          <div className="chat-brand">
            <div className="chat-avatar">🤖</div>
            <div className="chat-brand-name">Copilot Chef AI</div>
            <div className="chat-brand-sub">GitHub Copilot</div>
            <div className="chat-online" />
          </div>

          {/* Messages */}
          <div className="chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`chat-bubble ${msg.role}`}>{msg.text}</div>
            ))}
            {isTyping && (
              <div className="typing-indicator">
                <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="quick-prompts-col">
            <div className="qp-label">Quick Prompts</div>
            {QUICK_PROMPTS.map((qp) => (
              <button key={qp.label} className="qp-btn" onClick={() => sendMessage(qp.label)}>
                <span className="qp-icon">{qp.icon}</span>{qp.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="chat-input-row">
            <textarea
              className="chat-input"
              placeholder="Ask me anything about your meals..."
              value={chatInput}
              rows={1}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            />
            <button className="chat-send-btn" onClick={() => sendMessage()}>➤</button>
          </div>
        </div>

        {/* OVERVIEW — heatmap + grocery side by side */}
        <div className="section-divider fade-in">Overview</div>
        <div className="grid-2 fade-in">

          {/* Heatmap card */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🔥 Meal Activity</div>
              <a className="card-action">View Plan →</a>
            </div>
            <div className="heatmap-wrap">
              {/* Month label row */}
              <div className="heatmap-month-row">
                <div /> {/* spacer for day-label column */}
                {HEATMAP.map((week, wi) => {
                  const mo = week[0].date.toLocaleString("default", { month: "short" });
                  const isFirst = Object.values(MONTH_STARTS)[Object.keys(MONTH_STARTS).indexOf(mo)] === wi;
                  return <div key={wi} className="hm-mo-cell">{isFirst ? mo : ""}</div>;
                })}
              </div>
              {/* Main grid: day labels in col 1, week cells in cols 2–14 */}
              <div className="heatmap-grid">
                {/* Day labels — placed in col 1, rows 1–7 */}
                {["M","","W","","F","",""].map((lbl, di) => (
                  <div key={`lbl-${di}`} className="hm-day-label"
                    style={{ gridColumn: 1, gridRow: di + 1 }}>
                    {lbl}
                  </div>
                ))}
                {/* Cells — col = week index + 2, row = day index + 1 */}
                {HEATMAP.map((week, wi) =>
                  week.map((cell, di) => (
                    <div
                      key={`${wi}-${di}`}
                      className="hm-sq"
                      style={{
                        gridColumn: wi + 2,
                        gridRow: di + 1,
                        background: heatColor(cell.meals, cell.isFuture),
                      }}
                      onMouseEnter={(e) => setTooltip({
                        x: e.clientX, y: e.clientY,
                        text: cell.isFuture ? "Not yet" :
                          `${cell.date.toLocaleDateString("default", { month: "short", day: "numeric" })} — ${cell.meals} meal${cell.meals !== 1 ? "s" : ""}`
                      })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  ))
                )}
              </div>
              {/* Legend */}
              <div className="heatmap-legend">
                <span className="hm-leg-lbl">Less</span>
                {["#E4DDD0", "#A8C8B0", "#6FA882", "#3B5E45"].map((c) => (
                  <div key={c} className="hm-leg-sq" style={{ background: c }} />
                ))}
                <span className="hm-leg-lbl">More</span>
              </div>
            </div>
          </div>

          {/* Grocery Summary */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">🛒 Grocery List</div>
              <a className="card-action">Full List →</a>
            </div>
            <div className="grocery-summary">
              <div>
                <div className="grocery-list-name">This Week's Shop</div>
                <div className="grocery-list-meta">Created Mar 10 · {groceries.length} items</div>
              </div>
              <div>
                <div className="grocery-stat-row">
                  <div>
                    <span className="grocery-stat-big">{checkedCount}</span>
                    <span className="grocery-stat-label">of {groceries.length} collected</span>
                  </div>
                  <span className="grocery-pct">{groceryPct}%</span>
                </div>
                <div className="progress-bar-bg">
                  <div className="progress-bar-fill" style={{ width: `${groceryPct}%` }} />
                </div>
              </div>
              <button className="grocery-go-btn">Open List →</button>
            </div>
          </div>

        </div>
      </main>

      {/* Heatmap tooltip */}
      {tooltip && (
        <div className="heat-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
