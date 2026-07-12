"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type DeliveryType = "ambient" | "fresh";
type CartItem = { item_id: string; item_name: string; quantity: number; delivery_type: DeliveryType; product_url: string | null };

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState<DeliveryType>("ambient");
  const [items, setItems] = useState<CartItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const response = await fetch(`/api/cart?deliveryType=${tab}`);
      if (response.status === 401) { setMessage(""); setAuthenticated(false); return; }
      const body = await response.json();
      if (response.ok) setItems(body.items);
      else setMessage(body.error);
    } catch {
      setMessage("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    }
  }, [tab]);

  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.json()).then((body) => setAuthenticated(body.authenticated));
  }, []);
  useEffect(() => {
    if (!authenticated) return;
    fetch(`/api/cart?deliveryType=${tab}`).then((response) => {
      if (response.status === 401) { setMessage(""); setAuthenticated(false); }
      return response.json();
    }).then((body) => {
      if (body.items) setItems(body.items);
      else if (body.error) setMessage(body.error);
    }).catch(() => setMessage("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요."));
  }, [authenticated, tab]);

  async function login(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pin }) });
    const body = await response.json(); setBusy(false);
    if (response.ok) { setPin(""); setMessage(""); setAuthenticated(true); }
    else setMessage(body.error);
  }

  async function addItem(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/cart", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ inputValue, quantity, deliveryType: tab }) });
    const body = await response.json(); setBusy(false);
    if (response.ok) { setInputValue(""); setQuantity(1); await loadItems(); }
    else setMessage(body.error);
  }

  async function updateItem(id: string, changes: { quantity?: number; deliveryType?: DeliveryType }) {
    setMessage("");
    const response = await fetch(`/api/cart/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
    const body = await response.json();
    if (response.ok) await loadItems(); else setMessage(body.error);
  }

  async function deleteItem(id: string) {
    const response = await fetch(`/api/cart/${id}`, { method: "DELETE" });
    const body = await response.json();
    if (response.ok) await loadItems(); else setMessage(body.error);
  }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setAuthenticated(false); setItems([]); }

  if (authenticated === null) return <main className="shell"><p>불러오는 중...</p></main>;
  if (!authenticated) return <main className="shell login"><section className="panel"><p className="eyebrow">우리집 쇼핑 메모</p><h1>고메 Wisely 장바구니</h1><p className="muted">함께 사용할 숫자 4자리 PIN을 입력하세요.</p><form onSubmit={login}><label htmlFor="pin">공용 PIN</label><input id="pin" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="current-password" maxLength={4} pattern="\d{4}" required autoFocus /><button disabled={busy || pin.length !== 4}>{busy ? "확인 중..." : "들어가기"}</button></form>{message && <p className="error" role="alert">{message}</p>}</section></main>;

  return <main className="shell"><header><div><p className="eyebrow">우리집 쇼핑 메모</p><h1>고메 Wisely 장바구니</h1></div><button className="secondary compact" onClick={logout}>로그아웃</button></header><nav className="tabs" aria-label="배송 유형">{(["ambient", "fresh"] as const).map((value) => <button key={value} className={tab === value ? "active" : ""} aria-pressed={tab === value} onClick={() => setTab(value)}>{value === "ambient" ? "상온배송" : "신선배송"}</button>)}</nav><section className="panel add"><form onSubmit={addItem}><label htmlFor="item">제품명 또는 와이즐리 URL</label><input id="item" value={inputValue} onChange={(e) => setInputValue(e.target.value)} placeholder="필요한 제품을 빠르게 적어보세요" required /><div className="add-row"><div className="quantity-row"><span>수량</span><div className="stepper"><button type="button" className="secondary" disabled={quantity === 1} onClick={() => setQuantity((v) => Math.max(1, v - 1))}>−</button><input aria-label="수량" type="number" min="1" max="999" value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))} /><button type="button" className="secondary" onClick={() => setQuantity((v) => v + 1)}>＋</button></div></div><button disabled={busy}>{busy ? "추가 중..." : "장바구니에 추가"}</button></div></form>{message && <p className="error" role="alert">{message}</p>}</section><section className="list" aria-live="polite">{items.length === 0 ? <div className="empty"><h2>{tab === "ambient" ? "상온배송" : "신선배송"} 장바구니가 비어 있습니다.</h2><p>필요한 제품명이나 와이즐리 URL을 추가해보세요.</p></div> : items.map((item) => <article className="card" key={item.item_id}><h2>{item.item_name}</h2><div className="stepper"><button className="secondary" disabled={item.quantity === 1} onClick={() => updateItem(item.item_id, { quantity: item.quantity - 1 })}>−</button><input aria-label={`${item.item_name} 수량`} type="number" min="1" max="999" value={item.quantity} onChange={(e) => updateItem(item.item_id, { quantity: Math.max(1, Number(e.target.value)) })} /><button className="secondary" onClick={() => updateItem(item.item_id, { quantity: item.quantity + 1 })}>＋</button></div><div className="actions">{item.product_url && <a href={item.product_url} target="_blank" rel="noreferrer">와이즐리에서 보기</a>}<button className="secondary" onClick={() => updateItem(item.item_id, { deliveryType: tab === "ambient" ? "fresh" : "ambient" })}>{tab === "ambient" ? "신선배송" : "상온배송"}으로 이동</button><button className="danger" onClick={() => deleteItem(item.item_id)}>삭제</button></div></article>)}</section></main>;
}
