import { useState, useRef, useEffect } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const CATEGORIES = ["Produce","Meat & Fish","Dairy & Eggs","Bakery","Pantry","Frozen","Drinks","Other"];
const UNITS = ["","pcs","g","kg","ml","L","cups","tbsp","tsp","oz","lb","bunches","cans","bags","boxes"];
const NAV_ITEMS = ["Home","Calendar","Meal Plan","Grocery List","Stats"];
const FILTERS = [
  { id:"today",    label:"Today",        icon:"📅" },
  { id:"upcoming", label:"Next 7 Days",  icon:"🗓️" },
  { id:"fav",      label:"Favourites",   icon:"⭐" },
  { id:"recent",   label:"Recent",       icon:"🕐" },
];

// ─── Mock Data ────────────────────────────────────────────────────────────────
const TODAY = new Date(2026,2,12);
const d = (offset) => { const dt = new Date(TODAY); dt.setDate(dt.getDate()+offset); return dt; };

const MOCK_LISTS = [
  {
    id:1, name:"This Week's Shop", date: d(0), favourite:true,
    mealPlan:"Cozy Weeknight Plan",
    items:[
      { id:101, name:"Whole chicken",       qty:1,   unit:"",    category:"Meat & Fish", notes:"Free-range if available", meal:"Roast Chicken",   checked:false },
      { id:102, name:"Butternut squash",    qty:2,   unit:"pcs", category:"Produce",     notes:"",                        meal:"Risotto",         checked:true  },
      { id:103, name:"Arborio rice",        qty:500, unit:"g",   category:"Pantry",      notes:"Carnaroli works too",     meal:"Risotto",         checked:false },
      { id:104, name:"Fresh thyme",         qty:1,   unit:"bunches", category:"Produce", notes:"",                        meal:"Roast Chicken",   checked:false },
      { id:105, name:"Parmesan block",      qty:150, unit:"g",   category:"Dairy & Eggs",notes:"Parmigiano Reggiano",     meal:"Risotto",         checked:true  },
      { id:106, name:"Salmon fillets",      qty:2,   unit:"pcs", category:"Meat & Fish", notes:"Skin-on",                 meal:"Miso Salmon",     checked:false },
      { id:107, name:"White miso paste",    qty:1,   unit:"",    category:"Pantry",      notes:"",                        meal:"Miso Salmon",     checked:true  },
      { id:108, name:"Sourdough loaf",      qty:1,   unit:"",    category:"Bakery",      notes:"From the bakery section", meal:"",                checked:false },
    ]
  },
  {
    id:2, name:"Weekend Brunch Prep", date: d(2), favourite:false,
    mealPlan:"",
    items:[
      { id:201, name:"Ricotta",       qty:250, unit:"g",   category:"Dairy & Eggs", notes:"Full fat", meal:"Pancakes", checked:false },
      { id:202, name:"Lemons",        qty:3,   unit:"pcs", category:"Produce",      notes:"",         meal:"Pancakes", checked:false },
      { id:203, name:"Maple syrup",   qty:1,   unit:"",    category:"Pantry",       notes:"Pure, not maple-flavoured", meal:"Pancakes", checked:false },
      { id:204, name:"Smoked salmon", qty:100, unit:"g",   category:"Meat & Fish",  notes:"",         meal:"Eggs Benedict", checked:false },
    ]
  },
  {
    id:3, name:"Mid-week Top-up", date: d(3), favourite:true,
    mealPlan:"Cozy Weeknight Plan",
    items:[
      { id:301, name:"Cherry tomatoes", qty:1, unit:"bags",  category:"Produce",     notes:"", meal:"", checked:false },
      { id:302, name:"Greek yogurt",    qty:500,unit:"g",    category:"Dairy & Eggs",notes:"Full fat", meal:"", checked:false },
      { id:303, name:"Eggs",            qty:12, unit:"pcs",  category:"Dairy & Eggs",notes:"Free-range", meal:"", checked:false },
    ]
  },
  {
    id:4, name:"Next Week's Meals", date: d(6), favourite:false,
    mealPlan:"Spring Refresh Plan",
    items:[
      { id:401, name:"Lamb shoulder",   qty:800,unit:"g",   category:"Meat & Fish", notes:"Ask butcher to debone", meal:"Lamb Kofta", checked:false },
      { id:402, name:"Coconut milk",    qty:2,  unit:"cans",category:"Pantry",      notes:"Full fat",              meal:"Thai Curry", checked:false },
      { id:403, name:"Thai basil",      qty:1,  unit:"bunches",category:"Produce",  notes:"",                      meal:"Thai Curry", checked:false },
      { id:404, name:"Fish sauce",      qty:1,  unit:"",    category:"Pantry",      notes:"",                      meal:"Thai Curry", checked:false },
    ]
  },
  {
    id:5, name:"Party Snacks", date: d(10), favourite:false,
    mealPlan:"",
    items:[
      { id:501, name:"Brie",           qty:200,unit:"g",   category:"Dairy & Eggs",notes:"", meal:"", checked:false },
      { id:502, name:"Crackers assorted",qty:2,unit:"boxes",category:"Bakery",     notes:"", meal:"", checked:false },
      { id:503, name:"Grapes",         qty:500,unit:"g",   category:"Produce",     notes:"Red and green", meal:"", checked:false },
    ]
  },
];

let nextId = 600;
const newId = () => ++nextId;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtDate = (dt) => dt.toLocaleDateString("default",{month:"short",day:"numeric"});
const isToday = (dt) => dt.toDateString() === TODAY.toDateString();
const isUpcoming = (dt, days=7) => { const diff = (dt - TODAY)/(1000*60*60*24); return diff>=0 && diff<=days; };
const progress = (items) => {
  if (!items.length) return 0;
  return Math.round(items.filter(i=>i.checked).length / items.length * 100);
};
const groupByCategory = (items) => {
  const map = {};
  CATEGORIES.forEach(c => { map[c] = []; });
  items.forEach(item => { (map[item.category] = map[item.category]||[]).push(item); });
  return Object.entries(map).filter(([,v])=>v.length>0);
};

// ─── Item Edit Row ────────────────────────────────────────────────────────────
function ItemRow({ item, index, total, onUpdate, onDelete, onMove }) {
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);

  return (
    <div className={`item-row ${dragging?"item-row-dragging":""}`}
      draggable onDragStart={()=>setDragging(true)} onDragEnd={()=>setDragging(false)}>
      <div className="item-row-main">
        <span className="drag-handle" title="Drag to reorder">⠿</span>
        <input type="checkbox" className="item-check" checked={item.checked}
          onChange={e=>onUpdate({...item,checked:e.target.checked})} />
        <input className={`item-name-input ${item.checked?"item-done":""}`} value={item.name}
          onChange={e=>onUpdate({...item,name:e.target.value})} placeholder="Item name…" />
        <div className="item-qty-row">
          <input className="item-qty-input" type="number" min="0" value={item.qty||""}
            onChange={e=>onUpdate({...item,qty:e.target.value})} placeholder="Qty" />
          <select className="item-unit-select" value={item.unit}
            onChange={e=>onUpdate({...item,unit:e.target.value})}>
            {UNITS.map(u=><option key={u} value={u}>{u||"—"}</option>)}
          </select>
        </div>
        <select className="item-cat-select" value={item.category}
          onChange={e=>onUpdate({...item,category:e.target.value})}>
          {CATEGORIES.map(c=><option key={c}>{c}</option>)}
        </select>
        <div className="item-row-actions">
          <button className="item-arrow" onClick={()=>onMove(index,-1)} disabled={index===0} title="Move up">↑</button>
          <button className="item-arrow" onClick={()=>onMove(index,1)} disabled={index===total-1} title="Move down">↓</button>
          <button className="item-expand-btn" onClick={()=>setExpanded(e=>!e)} title="More fields">
            {expanded?"▲":"▼"}
          </button>
          <button className="item-delete-btn" onClick={()=>onDelete(item.id)} title="Remove">✕</button>
        </div>
      </div>
      {expanded && (
        <div className="item-row-extra">
          <div className="item-extra-field">
            <label className="item-extra-label">Notes / Brand</label>
            <input className="item-extra-input" value={item.notes}
              onChange={e=>onUpdate({...item,notes:e.target.value})} placeholder="e.g. Free-range, organic…" />
          </div>
          <div className="item-extra-field">
            <label className="item-extra-label">Linked Meal</label>
            <input className="item-extra-input" value={item.meal}
              onChange={e=>onUpdate({...item,meal:e.target.value})} placeholder="e.g. Roast Chicken" />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── List Editor Panel ────────────────────────────────────────────────────────
function ListEditor({ list, onChange, onDelete, onShop }) {
  const [editingName, setEditingName] = useState(false);
  const [nameVal, setNameVal] = useState(list.name);
  const [newItemName, setNewItemName] = useState("");
  const nameRef = useRef();

  useEffect(()=>{ setNameVal(list.name); },[list.id]);
  useEffect(()=>{ if(editingName) nameRef.current?.focus(); },[editingName]);

  const updateItem = (updated) => onChange({ ...list, items: list.items.map(i=>i.id===updated.id?updated:i) });
  const deleteItem = (id) => onChange({ ...list, items: list.items.filter(i=>i.id!==id) });
  const moveItem = (index, dir) => {
    const items = [...list.items];
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    [items[index], items[target]] = [items[target], items[index]];
    onChange({ ...list, items });
  };
  const addItem = () => {
    if (!newItemName.trim()) return;
    onChange({ ...list, items: [...list.items, {
      id: newId(), name: newItemName.trim(), qty:"", unit:"", category:"Produce",
      notes:"", meal:"", checked:false
    }]});
    setNewItemName("");
  };
  const saveName = () => { onChange({...list, name: nameVal}); setEditingName(false); };
  const pct = progress(list.items);
  const done = list.items.filter(i=>i.checked).length;

  return (
    <div className="editor-panel">
      {/* Editor header */}
      <div className="editor-header">
        <div className="editor-title-row">
          {editingName
            ? <input ref={nameRef} className="editor-name-input" value={nameVal}
                onChange={e=>setNameVal(e.target.value)}
                onBlur={saveName} onKeyDown={e=>{if(e.key==="Enter")saveName();if(e.key==="Escape")setEditingName(false);}} />
            : <h2 className="editor-name" onClick={()=>setEditingName(true)} title="Click to rename">{list.name} <span className="edit-pencil">✎</span></h2>
          }
          <div className="editor-header-meta">
            <span className="editor-date">📅 {fmtDate(list.date)}</span>
            {list.mealPlan && <span className="editor-meal-plan-tag">🍽 {list.mealPlan}</span>}
          </div>
        </div>
        <div className="editor-header-actions">
          <button className="btn-shop" onClick={onShop}>🛒 Shop</button>
          <button className="btn-telegram-disabled" disabled title="Coming soon — send to Telegram">
            <span className="telegram-icon">✈</span> Send to Telegram
          </button>
          <button className="btn-delete-list" onClick={()=>onDelete(list.id)} title="Delete list">🗑</button>
        </div>
      </div>

      {/* Progress */}
      <div className="editor-progress">
        <div className="progress-bar-bg">
          <div className="progress-bar-fill" style={{width:`${pct}%`}} />
        </div>
        <span className="progress-label">{done} of {list.items.length} collected · {pct}%</span>
      </div>

      {/* Items */}
      <div className="editor-items">
        {list.items.length === 0
          ? <div className="editor-empty">No items yet — add one below.</div>
          : list.items.map((item,i) => (
              <ItemRow key={item.id} item={item} index={i} total={list.items.length}
                onUpdate={updateItem} onDelete={deleteItem} onMove={moveItem} />
            ))
        }
      </div>

      {/* Add item */}
      <div className="editor-add-row">
        <input className="editor-add-input" value={newItemName}
          onChange={e=>setNewItemName(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&addItem()}
          placeholder="Add an item…" />
        <button className="btn-add-item" onClick={addItem}>+ Add</button>
      </div>
    </div>
  );
}

// ─── Shopping View ────────────────────────────────────────────────────────────
function ShoppingView({ list, onChange, onClose }) {
  const groups = groupByCategory(list.items);
  const done = list.items.filter(i=>i.checked).length;
  const pct = progress(list.items);
  const toggleItem = (id) => onChange({
    ...list, items: list.items.map(i=>i.id===id?{...i,checked:!i.checked}:i)
  });

  return (
    <div className="shopping-overlay">
      <div className="shopping-header">
        <div className="shopping-header-left">
          <span className="shopping-logo">🍳</span>
          <div>
            <div className="shopping-list-name">{list.name}</div>
            <div className="shopping-progress-text">{done} of {list.items.length} collected</div>
          </div>
        </div>
        <button className="shopping-close" onClick={onClose}>✕ Done</button>
      </div>
      <div className="shopping-progress-bar-bg">
        <div className="shopping-progress-fill" style={{width:`${pct}%`}} />
      </div>
      <div className="shopping-body">
        {groups.map(([cat, items]) => (
          <div key={cat} className="shopping-category">
            <div className="shopping-cat-header">{cat}</div>
            {items.map(item => (
              <button key={item.id}
                className={`shopping-item ${item.checked?"shopping-item-done":""}`}
                onClick={()=>toggleItem(item.id)}>
                <div className={`shopping-check-circle ${item.checked?"shopping-check-filled":""}`}>
                  {item.checked && <span className="shopping-checkmark">✓</span>}
                </div>
                <div className="shopping-item-info">
                  <span className="shopping-item-name">{item.name}</span>
                  <div className="shopping-item-meta">
                    {item.qty && <span>{item.qty}{item.unit ? ` ${item.unit}` : ""}</span>}
                    {item.notes && <span className="shopping-item-notes">· {item.notes}</span>}
                    {item.meal && <span className="shopping-item-meal">for {item.meal}</span>}
                  </div>
                </div>
                <div className="shopping-item-right">
                  {item.checked
                    ? <span className="shopping-status-done">Collected</span>
                    : <span className="shopping-status-open">Needed</span>
                  }
                </div>
              </button>
            ))}
          </div>
        ))}
        {list.items.length === 0 && (
          <div className="shopping-empty">This list has no items yet.</div>
        )}
      </div>
    </div>
  );
}

// ─── New List Modal ───────────────────────────────────────────────────────────
function NewListModal({ onClose, onCreate }) {
  const [name, setName] = useState("");
  const [date, setDate] = useState(TODAY.toISOString().split("T")[0]);

  return (
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="new-list-modal">
        <div className="new-list-header">
          <h3 className="new-list-title">New Grocery List</h3>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="new-list-body">
          <div className="form-group">
            <label className="form-label">List Name</label>
            <input className="form-input" value={name} onChange={e=>setName(e.target.value)}
              placeholder="e.g. This Week's Shop" autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={date} onChange={e=>setDate(e.target.value)} />
          </div>
        </div>
        <div className="new-list-footer">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-create" onClick={()=>{
            if(!name.trim()) return;
            onCreate({ id: newId(), name: name.trim(), date: new Date(date+"T12:00:00"),
              favourite:false, mealPlan:"", items:[] });
            onClose();
          }}>Create List</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function GroceryPage() {
  const [lists, setLists] = useState(MOCK_LISTS);
  const [selectedId, setSelectedId] = useState(1);
  const [activeFilter, setActiveFilter] = useState("today");
  const [upcomingDays, setUpcomingDays] = useState(7);
  const [shopping, setShopping] = useState(false);
  const [showNewModal, setShowNewModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const carouselRef = useRef();

  const selectedList = lists.find(l=>l.id===selectedId);

  const updateList = (updated) => setLists(ls=>ls.map(l=>l.id===updated.id?updated:l));
  const deleteList = (id) => {
    setLists(ls=>ls.filter(l=>l.id!==id));
    const remaining = lists.filter(l=>l.id!==id);
    setSelectedId(remaining.length ? remaining[0].id : null);
  };
  const toggleFav = (id) => setLists(ls=>ls.map(l=>l.id===id?{...l,favourite:!l.favourite}:l));
  const createList = (l) => { setLists(ls=>[...ls,l]); setSelectedId(l.id); };

  const filteredQuick = lists.filter(l => {
    if (activeFilter==="today") return isToday(l.date);
    if (activeFilter==="upcoming") return isUpcoming(l.date, upcomingDays);
    if (activeFilter==="fav") return l.favourite;
    if (activeFilter==="recent") return true;
    return true;
  }).slice(0, activeFilter==="recent" ? 5 : undefined);

  if (shopping && selectedList) {
    return <ShoppingView list={selectedList} onChange={updateList} onClose={()=>setShopping(false)} />;
  }

  return (
    <div style={{fontFamily:"'Nunito',sans-serif",background:"var(--cream)",minHeight:"100vh",color:"var(--text)"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,600;0,700;1,400&family=Nunito:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        :root{
          --green:#3B5E45;--green-light:#5A7D63;--green-pale:#D4E4D8;
          --cream:#F5F0E8;--cream-dark:#EDE6D6;
          --orange:#C5622A;--orange-light:#E8885A;
          --text:#2C2416;--text-muted:#7A6A58;--white:#FFFDF8;
          --shadow:0 2px 12px rgba(44,36,22,0.10);
          --shadow-lg:0 6px 28px rgba(44,36,22,0.14);
        }

        /* NAV */
        .header{background:var(--green);padding:0 2rem;height:64px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:200;box-shadow:0 2px 16px rgba(44,36,22,0.18);}
        .logo{font-family:'Lora',serif;font-size:1.45rem;font-weight:700;color:#FFFDF8;display:flex;align-items:center;gap:0.5rem;}
        .nav-desktop{display:flex;gap:0.25rem;}
        .nav-link{font-family:'Nunito',sans-serif;font-size:0.9rem;font-weight:600;color:rgba(255,253,248,0.75);padding:0.45rem 1rem;border-radius:8px;cursor:pointer;border:none;background:none;transition:all 0.18s;}
        .nav-link:hover{color:#FFFDF8;background:rgba(255,253,248,0.1);}
        .nav-link.active{color:#FFFDF8;background:rgba(255,253,248,0.18);}
        .nav-right{display:flex;align-items:center;gap:0.5rem;}
        .settings-btn{width:38px;height:38px;border-radius:50%;background:rgba(255,253,248,0.12);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.1rem;color:#FFFDF8;}
        .hamburger{display:none;width:38px;height:38px;border-radius:8px;background:rgba(255,253,248,0.12);border:none;cursor:pointer;align-items:center;justify-content:center;flex-direction:column;gap:5px;padding:10px;}
        .hamburger span{display:block;width:18px;height:2px;background:#FFFDF8;border-radius:2px;}
        .mobile-menu{display:none;position:fixed;top:64px;left:0;right:0;background:var(--green);padding:1rem;z-index:199;flex-direction:column;gap:0.25rem;border-bottom:3px solid var(--orange);box-shadow:var(--shadow-lg);}
        .mobile-menu.open{display:flex;}
        .mobile-nav-link{font-family:'Nunito',sans-serif;font-size:1rem;font-weight:600;color:rgba(255,253,248,0.85);padding:0.75rem 1rem;border-radius:8px;cursor:pointer;border:none;background:none;text-align:left;}
        .mobile-nav-link.active{background:rgba(255,253,248,0.15);color:#FFFDF8;}

        /* PAGE */
        .page{max-width:1280px;margin:0 auto;padding:2rem 2rem 4rem;}

        /* PAGE HEADER */
        .page-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:1.75rem;gap:1rem;flex-wrap:wrap;}
        .eyebrow{font-family:'Nunito',sans-serif;font-size:0.72rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:var(--orange);margin-bottom:0.3rem;}
        .page-title{font-family:'Lora',serif;font-size:2rem;font-weight:700;line-height:1.15;}
        .page-sub{font-family:'Nunito',sans-serif;font-size:0.9rem;color:var(--text-muted);margin-top:0.3rem;}
        .btn-new-list{font-family:'Nunito',sans-serif;font-size:0.82rem;font-weight:700;background:var(--orange);color:#FFFDF8;border:none;border-radius:10px;padding:0.55rem 1.1rem;cursor:pointer;white-space:nowrap;transition:background 0.15s;margin-top:0.25rem;}
        .btn-new-list:hover{background:var(--orange-light);}

        /* QUICK REFERENCE */
        .section-label{font-family:'Nunito',sans-serif;font-size:0.72rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.75rem;display:flex;align-items:center;gap:0.75rem;}
        .section-label::after{content:'';flex:1;height:1px;background:var(--cream-dark);}
        .filter-tabs{display:flex;gap:0.4rem;margin-bottom:0.85rem;flex-wrap:wrap;align-items:center;}
        .filter-tab{font-family:'Nunito',sans-serif;font-size:0.75rem;font-weight:700;padding:0.3rem 0.75rem;border-radius:99px;border:1.5px solid var(--cream-dark);background:var(--white);color:var(--text-muted);cursor:pointer;transition:all 0.15s;display:flex;align-items:center;gap:0.3rem;}
        .filter-tab:hover{border-color:var(--green-light);color:var(--green);}
        .filter-tab.active{background:var(--green);border-color:var(--green);color:#FFFDF8;}
        .upcoming-input{font-family:'Nunito',sans-serif;font-size:0.75rem;font-weight:700;width:48px;padding:0.28rem 0.5rem;border-radius:8px;border:1.5px solid var(--cream-dark);background:var(--white);color:var(--text);text-align:center;margin-left:0.3rem;}
        .carousel-wrap{position:relative;overflow-x:auto;padding-top:8px;margin-top:-8px;}
        .carousel-wrap::-webkit-scrollbar{height:4px;}
        .carousel-wrap::-webkit-scrollbar-thumb{background:var(--cream-dark);border-radius:4px;}
        .carousel{display:flex;gap:0.85rem;padding-bottom:8px;padding-top:2px;width:max-content;scroll-behavior:smooth;}
        .quick-card{background:var(--white);border-radius:14px;padding:1rem 1.1rem;min-width:190px;max-width:190px;box-shadow:var(--shadow);border:1.5px solid transparent;cursor:pointer;transition:all 0.16s;flex-shrink:0;display:flex;flex-direction:column;gap:0.4rem;position:relative;}
        .quick-card:hover{border-color:var(--green-pale);transform:translateY(-2px);box-shadow:var(--shadow-lg);}
        .quick-card.selected{border-color:var(--green);box-shadow:0 0 0 3px var(--green-pale);}
        .quick-card-name{font-family:'Lora',serif;font-size:0.9rem;font-weight:700;color:var(--text);line-height:1.3;}
        .quick-card-date{font-family:'Nunito',sans-serif;font-size:0.7rem;font-weight:600;color:var(--text-muted);}
        .quick-card-meta{font-family:'Nunito',sans-serif;font-size:0.68rem;color:var(--text-muted);}
        .quick-card-progress{height:5px;background:var(--cream-dark);border-radius:99px;overflow:hidden;margin-top:0.3rem;}
        .quick-card-fill{height:100%;background:var(--green);border-radius:99px;}
        .quick-card-fav{position:absolute;top:0.65rem;right:0.7rem;background:none;border:none;cursor:pointer;font-size:0.9rem;opacity:0.6;padding:2px;}
        .quick-card-fav:hover{opacity:1;}
        .quick-card-fav.active{opacity:1;}
        .quick-empty{font-family:'Nunito',sans-serif;font-size:0.85rem;color:var(--text-muted);padding:1rem 0;font-style:italic;}

        /* MAIN 2-COL */
        .main-cols{display:grid;grid-template-columns:260px 1fr;gap:1.25rem;align-items:start;margin-top:1.5rem;}

        /* ALL LISTS sidebar */
        .lists-sidebar{background:var(--white);border-radius:16px;box-shadow:var(--shadow);border:1px solid rgba(59,94,69,0.08);overflow:hidden;}
        .sidebar-header{padding:0.9rem 1rem;border-bottom:1px solid var(--cream-dark);display:flex;align-items:center;justify-content:space-between;}
        .sidebar-title{font-family:'Nunito',sans-serif;font-size:0.75rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-muted);}
        .sidebar-count{font-family:'Nunito',sans-serif;font-size:0.7rem;font-weight:700;color:var(--text-muted);background:var(--cream-dark);padding:2px 7px;border-radius:99px;}
        .list-row{display:flex;align-items:center;gap:0.6rem;padding:0.75rem 1rem;cursor:pointer;border-bottom:1px solid var(--cream-dark);transition:background 0.12s;border-left:3px solid transparent;}
        .list-row:last-child{border-bottom:none;}
        .list-row:hover{background:var(--cream);}
        .list-row.selected{background:rgba(59,94,69,0.05);border-left-color:var(--green);}
        .list-row-info{flex:1;min-width:0;}
        .list-row-name{font-family:'Nunito',sans-serif;font-size:0.82rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        .list-row-meta{font-family:'Nunito',sans-serif;font-size:0.68rem;color:var(--text-muted);}
        .list-row-fav{background:none;border:none;cursor:pointer;font-size:0.75rem;padding:2px;opacity:0.5;flex-shrink:0;}
        .list-row-fav:hover,.list-row-fav.on{opacity:1;}
        .list-row-pct{font-family:'Nunito',sans-serif;font-size:0.68rem;font-weight:700;color:var(--green);flex-shrink:0;}

        /* EDITOR */
        .editor-panel{background:var(--white);border-radius:16px;box-shadow:var(--shadow);border:1px solid rgba(59,94,69,0.08);overflow:hidden;}
        .editor-header{padding:1.1rem 1.25rem;border-bottom:1px solid var(--cream-dark);display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;flex-wrap:wrap;}
        .editor-title-row{flex:1;}
        .editor-name{font-family:'Lora',serif;font-size:1.35rem;font-weight:700;color:var(--text);cursor:pointer;display:flex;align-items:center;gap:0.5rem;line-height:1.2;}
        .editor-name:hover .edit-pencil{opacity:1;}
        .edit-pencil{font-size:0.8rem;color:var(--text-muted);opacity:0;transition:opacity 0.15s;font-family:'Nunito',sans-serif;}
        .editor-name-input{font-family:'Lora',serif;font-size:1.35rem;font-weight:700;color:var(--text);border:none;border-bottom:2px solid var(--green);background:transparent;outline:none;width:100%;}
        .editor-header-meta{display:flex;align-items:center;gap:0.6rem;margin-top:0.35rem;flex-wrap:wrap;}
        .editor-date{font-family:'Nunito',sans-serif;font-size:0.75rem;font-weight:600;color:var(--text-muted);}
        .editor-meal-plan-tag{font-family:'Nunito',sans-serif;font-size:0.7rem;font-weight:700;color:var(--green);background:var(--green-pale);padding:2px 8px;border-radius:99px;}
        .editor-header-actions{display:flex;align-items:center;gap:0.5rem;flex-shrink:0;}
        .btn-shop{font-family:'Nunito',sans-serif;font-size:0.78rem;font-weight:700;background:var(--green);color:#FFFDF8;border:none;border-radius:8px;padding:0.4rem 0.9rem;cursor:pointer;transition:background 0.14s;}
        .btn-shop:hover{background:var(--green-light);}
        .btn-telegram-disabled{font-family:'Nunito',sans-serif;font-size:0.75rem;font-weight:700;background:var(--cream-dark);color:var(--text-muted);border:1.5px solid var(--cream-dark);border-radius:8px;padding:0.4rem 0.85rem;cursor:not-allowed;opacity:0.65;display:flex;align-items:center;gap:0.4rem;}
        .telegram-icon{font-style:normal;}
        .btn-delete-list{background:none;border:1.5px solid var(--cream-dark);border-radius:8px;padding:0.4rem 0.6rem;cursor:pointer;color:var(--text-muted);font-size:0.85rem;transition:all 0.14s;}
        .btn-delete-list:hover{border-color:#C0392B;color:#C0392B;}
        .editor-progress{padding:0.75rem 1.25rem;border-bottom:1px solid var(--cream-dark);display:flex;align-items:center;gap:0.85rem;}
        .progress-bar-bg{flex:1;height:7px;background:var(--cream-dark);border-radius:99px;overflow:hidden;}
        .progress-bar-fill{height:100%;background:linear-gradient(90deg,var(--green),#6FA882);border-radius:99px;transition:width 0.4s ease;}
        .progress-label{font-family:'Nunito',sans-serif;font-size:0.72rem;font-weight:700;color:var(--text-muted);white-space:nowrap;}
        .editor-items{max-height:480px;overflow-y:auto;padding:0.5rem 0;}
        .editor-empty{font-family:'Nunito',sans-serif;font-size:0.85rem;color:var(--text-muted);padding:1.5rem 1.25rem;font-style:italic;}

        /* ITEM ROW */
        .item-row{padding:0.55rem 1.25rem;border-bottom:1px solid var(--cream-dark);transition:background 0.1s;}
        .item-row:last-child{border-bottom:none;}
        .item-row:hover{background:rgba(245,240,232,0.6);}
        .item-row-dragging{opacity:0.5;background:var(--cream);}
        .item-row-main{display:flex;align-items:center;gap:0.55rem;}
        .drag-handle{color:var(--cream-dark);cursor:grab;font-size:1rem;flex-shrink:0;user-select:none;letter-spacing:-1px;}
        .drag-handle:hover{color:var(--text-muted);}
        .item-check{width:16px;height:16px;cursor:pointer;accent-color:var(--green);flex-shrink:0;}
        .item-name-input{font-family:'Nunito',sans-serif;font-size:0.85rem;font-weight:600;color:var(--text);border:none;background:transparent;outline:none;flex:1;min-width:0;padding:2px 0;}
        .item-name-input:focus{border-bottom:1px solid var(--green);}
        .item-done{text-decoration:line-through;color:var(--text-muted);}
        .item-qty-row{display:flex;gap:2px;flex-shrink:0;}
        .item-qty-input{font-family:'Nunito',sans-serif;font-size:0.75rem;width:48px;padding:0.2rem 0.35rem;border:1.5px solid var(--cream-dark);border-radius:6px 0 0 6px;background:var(--cream);color:var(--text);outline:none;text-align:center;}
        .item-qty-input:focus{border-color:var(--green);}
        .item-unit-select{font-family:'Nunito',sans-serif;font-size:0.72rem;padding:0.2rem 0.25rem;border:1.5px solid var(--cream-dark);border-left:none;border-radius:0 6px 6px 0;background:var(--cream);color:var(--text-muted);outline:none;max-width:52px;}
        .item-cat-select{font-family:'Nunito',sans-serif;font-size:0.7rem;padding:0.2rem 0.35rem;border:1.5px solid var(--cream-dark);border-radius:6px;background:var(--cream);color:var(--text-muted);outline:none;max-width:90px;}
        .item-row-actions{display:flex;align-items:center;gap:2px;flex-shrink:0;}
        .item-arrow{background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.8rem;padding:2px 4px;border-radius:4px;transition:all 0.12s;}
        .item-arrow:hover:not(:disabled){color:var(--green);background:var(--green-pale);}
        .item-arrow:disabled{opacity:0.2;cursor:default;}
        .item-expand-btn{background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.65rem;padding:2px 4px;border-radius:4px;}
        .item-expand-btn:hover{color:var(--green);}
        .item-delete-btn{background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:0.75rem;padding:2px 5px;border-radius:4px;}
        .item-delete-btn:hover{color:#C0392B;background:#FEE;}
        .item-row-extra{padding:0.5rem 1.25rem 0.65rem 2.8rem;background:rgba(245,240,232,0.5);display:flex;gap:1rem;flex-wrap:wrap;}
        .item-extra-field{display:flex;flex-direction:column;gap:0.25rem;flex:1;min-width:140px;}
        .item-extra-label{font-family:'Nunito',sans-serif;font-size:0.62rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--text-muted);}
        .item-extra-input{font-family:'Nunito',sans-serif;font-size:0.78rem;padding:0.3rem 0.6rem;border:1.5px solid var(--cream-dark);border-radius:7px;background:var(--white);color:var(--text);outline:none;}
        .item-extra-input:focus{border-color:var(--green);}
        .editor-add-row{display:flex;gap:0.5rem;padding:0.85rem 1.25rem;border-top:1px solid var(--cream-dark);}
        .editor-add-input{flex:1;font-family:'Nunito',sans-serif;font-size:0.85rem;padding:0.5rem 0.85rem;border:1.5px solid var(--cream-dark);border-radius:9px;background:var(--cream);color:var(--text);outline:none;}
        .editor-add-input:focus{border-color:var(--green);}
        .btn-add-item{font-family:'Nunito',sans-serif;font-size:0.8rem;font-weight:700;background:var(--green);color:#FFFDF8;border:none;border-radius:9px;padding:0.5rem 1rem;cursor:pointer;white-space:nowrap;}
        .btn-add-item:hover{background:var(--green-light);}

        /* SHOPPING VIEW */
        .shopping-overlay{position:fixed;inset:0;background:var(--cream);z-index:500;display:flex;flex-direction:column;overflow:hidden;}
        .shopping-header{background:var(--green);padding:1rem 1.5rem;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-shrink:0;}
        .shopping-logo{font-size:1.5rem;}
        .shopping-header-left{display:flex;align-items:center;gap:0.85rem;}
        .shopping-list-name{font-family:'Lora',serif;font-size:1.15rem;font-weight:700;color:#FFFDF8;}
        .shopping-progress-text{font-family:'Nunito',sans-serif;font-size:0.75rem;color:rgba(255,253,248,0.75);}
        .shopping-close{font-family:'Nunito',sans-serif;font-size:0.82rem;font-weight:700;background:rgba(255,253,248,0.15);color:#FFFDF8;border:1.5px solid rgba(255,253,248,0.3);border-radius:8px;padding:0.45rem 1rem;cursor:pointer;transition:background 0.14s;white-space:nowrap;}
        .shopping-close:hover{background:rgba(255,253,248,0.25);}
        .shopping-progress-bar-bg{height:5px;background:rgba(255,253,248,0.2);flex-shrink:0;}
        .shopping-progress-fill{height:100%;background:#FFFDF8;transition:width 0.4s;}
        .shopping-body{flex:1;overflow-y:auto;padding:1.25rem 1rem 3rem;}
        .shopping-category{margin-bottom:1.5rem;}
        .shopping-cat-header{font-family:'Nunito',sans-serif;font-size:0.7rem;font-weight:800;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-muted);padding:0 0.25rem 0.5rem;border-bottom:1px solid var(--cream-dark);margin-bottom:0.5rem;}
        .shopping-item{width:100%;display:flex;align-items:center;gap:1rem;padding:1rem 1rem;border-radius:12px;border:none;background:var(--white);box-shadow:var(--shadow);margin-bottom:0.5rem;cursor:pointer;text-align:left;transition:all 0.15s;}
        .shopping-item:hover{transform:translateY(-1px);box-shadow:var(--shadow-lg);}
        .shopping-item-done{background:var(--cream-dark);opacity:0.65;}
        .shopping-item-done:hover{transform:none;box-shadow:none;}
        .shopping-check-circle{width:28px;height:28px;border-radius:50%;border:2.5px solid var(--cream-dark);flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:all 0.15s;}
        .shopping-check-filled{background:var(--green);border-color:var(--green);}
        .shopping-checkmark{color:#FFFDF8;font-size:0.85rem;font-weight:700;}
        .shopping-item-info{flex:1;display:flex;flex-direction:column;gap:0.2rem;}
        .shopping-item-name{font-family:'Lora',serif;font-size:1.05rem;font-weight:600;color:var(--text);}
        .shopping-item-meta{font-family:'Nunito',sans-serif;font-size:0.75rem;color:var(--text-muted);display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;}
        .shopping-item-notes{font-style:italic;}
        .shopping-item-meal{background:var(--green-pale);color:var(--green);padding:1px 6px;border-radius:99px;font-weight:700;}
        .shopping-item-right{flex-shrink:0;}
        .shopping-status-open{font-family:'Nunito',sans-serif;font-size:0.68rem;font-weight:800;color:var(--orange);text-transform:uppercase;letter-spacing:0.06em;}
        .shopping-status-done{font-family:'Nunito',sans-serif;font-size:0.68rem;font-weight:800;color:var(--green-light);text-transform:uppercase;letter-spacing:0.06em;}
        .shopping-empty{font-family:'Nunito',sans-serif;font-size:0.9rem;color:var(--text-muted);text-align:center;padding:3rem;font-style:italic;}

        /* NEW LIST MODAL */
        .modal-overlay{position:fixed;inset:0;background:rgba(44,36,22,0.45);z-index:400;display:flex;align-items:center;justify-content:center;padding:1rem;backdrop-filter:blur(3px);}
        .new-list-modal{background:var(--white);border-radius:16px;width:100%;max-width:420px;box-shadow:var(--shadow-lg);overflow:hidden;}
        .new-list-header{display:flex;align-items:center;justify-content:space-between;padding:1.1rem 1.25rem;border-bottom:1px solid var(--cream-dark);}
        .new-list-title{font-family:'Lora',serif;font-size:1.1rem;font-weight:700;color:var(--text);}
        .modal-close-btn{background:none;border:1.5px solid var(--cream-dark);border-radius:50%;width:28px;height:28px;cursor:pointer;color:var(--text-muted);font-size:0.75rem;display:flex;align-items:center;justify-content:center;}
        .modal-close-btn:hover{border-color:var(--text-muted);color:var(--text);}
        .new-list-body{padding:1.25rem;display:flex;flex-direction:column;gap:1rem;}
        .form-group{display:flex;flex-direction:column;gap:0.35rem;}
        .form-label{font-family:'Nunito',sans-serif;font-size:0.68rem;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);}
        .form-input{font-family:'Nunito',sans-serif;font-size:0.88rem;padding:0.55rem 0.85rem;border:1.5px solid var(--cream-dark);border-radius:9px;background:var(--cream);color:var(--text);outline:none;}
        .form-input:focus{border-color:var(--green);}
        .new-list-footer{display:flex;justify-content:flex-end;gap:0.6rem;padding:1rem 1.25rem;border-top:1px solid var(--cream-dark);}
        .btn-ghost{font-family:'Nunito',sans-serif;font-size:0.82rem;font-weight:700;background:none;border:1.5px solid var(--cream-dark);border-radius:8px;padding:0.42rem 0.85rem;color:var(--text-muted);cursor:pointer;}
        .btn-ghost:hover{border-color:var(--text-muted);color:var(--text);}
        .btn-create{font-family:'Nunito',sans-serif;font-size:0.82rem;font-weight:700;background:var(--orange);color:#FFFDF8;border:none;border-radius:8px;padding:0.45rem 1.1rem;cursor:pointer;}
        .btn-create:hover{background:var(--orange-light);}

        /* NO SELECTION */
        .editor-placeholder{background:var(--white);border-radius:16px;box-shadow:var(--shadow);border:1px solid rgba(59,94,69,0.08);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4rem 2rem;gap:0.75rem;text-align:center;}
        .editor-placeholder-icon{font-size:2.5rem;opacity:0.3;}
        .editor-placeholder-text{font-family:'Nunito',sans-serif;font-size:0.9rem;color:var(--text-muted);}

        /* RESPONSIVE */
        @media(max-width:768px){
          .nav-desktop{display:none;}
          .hamburger{display:flex;}
          .page{padding:1.25rem 1rem 3rem;}
          .main-cols{grid-template-columns:1fr;grid-template-rows:auto auto;}
          .lists-sidebar{order:2;}
          .editor-panel,.editor-placeholder{order:1;}
          .editor-items{max-height:320px;}
          .item-cat-select{display:none;}
          .item-qty-row{display:none;}
          .editor-header{flex-direction:column;}
          .editor-header-actions{width:100%;justify-content:flex-start;}
          .shopping-body{padding:0.75rem 0.5rem 3rem;}
          .shopping-item{padding:0.85rem 0.75rem;}
          .shopping-item-name{font-size:1rem;}
        }
      `}</style>

      {/* Header */}
      <header className="header">
        <div className="logo">🍳 Copilot Chef</div>
        <nav className="nav-desktop">
          {NAV_ITEMS.map(item=>(
            <button key={item} className={`nav-link ${item==="Grocery List"?"active":""}`}>{item}</button>
          ))}
        </nav>
        <div className="nav-right">
          <button className="hamburger" onClick={()=>setMenuOpen(o=>!o)}>
            <span/><span/><span/>
          </button>
          <button className="settings-btn">⚙️</button>
        </div>
      </header>
      <div className={`mobile-menu ${menuOpen?"open":""}`}>
        {NAV_ITEMS.map(item=>(
          <button key={item} className={`mobile-nav-link ${item==="Grocery List"?"active":""}`}
            onClick={()=>setMenuOpen(false)}>{item}</button>
        ))}
      </div>

      <main className="page">
        {/* Page header */}
        <div className="page-header">
          <div>
            <div className="eyebrow">Grocery List</div>
            <h1 className="page-title">Your Lists</h1>
            <p className="page-sub">{lists.length} list{lists.length!==1?"s":""} · select one to edit</p>
          </div>
          <button className="btn-new-list" onClick={()=>setShowNewModal(true)}>+ New List</button>
        </div>

        {/* Quick Reference */}
        <div className="section-label">Quick Reference</div>
        <div className="filter-tabs">
          {FILTERS.map(f=>(
            <button key={f.id} className={`filter-tab ${activeFilter===f.id?"active":""}`}
              onClick={()=>setActiveFilter(f.id)}>
              {f.icon} {f.label}
            </button>
          ))}
          {activeFilter==="upcoming" && (
            <label style={{display:"flex",alignItems:"center",gap:"0.35rem",fontFamily:"'Nunito',sans-serif",fontSize:"0.75rem",fontWeight:700,color:"var(--text-muted)"}}>
              Days:
              <input type="number" className="upcoming-input" min={1} max={60} value={upcomingDays}
                onChange={e=>setUpcomingDays(Number(e.target.value))} />
            </label>
          )}
        </div>
        <div className="carousel-wrap">
          <div className="carousel" ref={carouselRef}>
            {filteredQuick.length===0
              ? <div className="quick-empty">No lists match this filter.</div>
              : filteredQuick.map(l=>{
                  const pct=progress(l.items);
                  return (
                    <div key={l.id} className={`quick-card ${selectedId===l.id?"selected":""}`}
                      onClick={()=>setSelectedId(l.id)}>
                      <button className={`quick-card-fav ${l.favourite?"active":""}`}
                        onClick={e=>{e.stopPropagation();toggleFav(l.id);}}>
                        {l.favourite?"⭐":"☆"}
                      </button>
                      <div className="quick-card-name">{l.name}</div>
                      <div className="quick-card-date">
                        {isToday(l.date)?"Today":fmtDate(l.date)} · {l.items.length} items
                      </div>
                      {l.mealPlan && <div className="quick-card-meta">🍽 {l.mealPlan}</div>}
                      <div className="quick-card-progress">
                        <div className="quick-card-fill" style={{width:`${pct}%`}} />
                      </div>
                      <div style={{fontFamily:"'Nunito',sans-serif",fontSize:"0.65rem",fontWeight:700,color:"var(--text-muted)",marginTop:"0.15rem"}}>{pct}% collected</div>
                    </div>
                  );
                })
            }
          </div>
        </div>

        {/* Main 2-col */}
        <div className="main-cols">
          {/* All lists sidebar */}
          <div className="lists-sidebar">
            <div className="sidebar-header">
              <span className="sidebar-title">All Lists</span>
              <span className="sidebar-count">{lists.length}</span>
            </div>
            {lists.map(l=>(
              <div key={l.id} className={`list-row ${selectedId===l.id?"selected":""}`}
                onClick={()=>setSelectedId(l.id)}>
                <div className="list-row-info">
                  <div className="list-row-name">{l.name}</div>
                  <div className="list-row-meta">{isToday(l.date)?"Today":fmtDate(l.date)} · {l.items.length} items</div>
                </div>
                <button className={`list-row-fav ${l.favourite?"on":""}`}
                  onClick={e=>{e.stopPropagation();toggleFav(l.id);}}>
                  {l.favourite?"⭐":"☆"}
                </button>
                <span className="list-row-pct">{progress(l.items)}%</span>
              </div>
            ))}
          </div>

          {/* Editor */}
          {selectedList
            ? <ListEditor list={selectedList} onChange={updateList}
                onDelete={deleteList} onShop={()=>setShopping(true)} />
            : <div className="editor-placeholder">
                <div className="editor-placeholder-icon">🛒</div>
                <p className="editor-placeholder-text">Select a list to start editing.</p>
              </div>
          }
        </div>
      </main>

      {showNewModal && <NewListModal onClose={()=>setShowNewModal(false)} onCreate={createList} />}
    </div>
  );
}
