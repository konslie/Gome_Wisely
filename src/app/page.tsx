"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";

type DeliveryType = "ambient" | "fresh";
type CartItem = {
  item_id: string;
  item_name: string;
  quantity: number;
  delivery_type: DeliveryType;
  product_url: string | null;
};

export default function Home() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [tab, setTab] = useState<DeliveryType>("ambient");
  const [items, setItems] = useState<CartItem[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [undoItem, setUndoItem] = useState<CartItem | null>(null);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [completingPurchase, setCompletingPurchase] = useState(false);
  const [completedCount, setCompletedCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((response) => response.json())
      .then((body) => setAuthenticated(body.authenticated))
      .catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    fetch(`/api/cart?deliveryType=${tab}`)
      .then((response) => {
        if (response.status === 401) {
          setMessage("");
          setAuthenticated(false);
        }
        return response.json();
      })
      .then((body) => {
        if (body.items) setItems(body.items);
        else if (body.error) setMessage(body.error);
      })
      .catch(() => setMessage("서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요."));
  }, [authenticated, tab]);

  useEffect(() => {
    if (!undoItem) return;
    const timeout = setTimeout(() => setUndoItem(null), 5_000);
    return () => clearTimeout(timeout);
  }, [undoItem]);

  async function login(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
        signal: controller.signal,
      });
      const body = await response.json();
      if (response.ok) {
        setPin("");
        setAuthenticated(true);
      } else {
        setMessage(body.error || "로그인에 실패했습니다.");
      }
    } catch {
      setMessage("로그인 서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      clearTimeout(timeout);
      setBusy(false);
    }
  }

  async function addItem(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inputValue, quantity, deliveryType: tab }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems((current) => [body.item, ...current]);
      setInputValue("");
      setQuantity(1);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "상품을 추가하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function updateItem(item: CartItem, changes: { quantity?: number; deliveryType?: DeliveryType }) {
    if (pendingIds.has(item.item_id)) return;
    setMessage("");
    setPendingIds((current) => new Set(current).add(item.item_id));
    const moved = changes.deliveryType && changes.deliveryType !== tab;
    setItems((current) => moved
      ? current.filter((candidate) => candidate.item_id !== item.item_id)
      : current.map((candidate) => candidate.item_id === item.item_id ? { ...candidate, ...changes, delivery_type: changes.deliveryType ?? candidate.delivery_type } : candidate));

    try {
      const response = await fetch(`/api/cart/${item.item_id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      if (!moved) {
        setItems((current) => current.map((candidate) => candidate.item_id === item.item_id ? body.item : candidate));
      }
    } catch (error) {
      setItems((current) => [item, ...current.filter((candidate) => candidate.item_id !== item.item_id)]);
      setMessage(error instanceof Error ? error.message : "상품을 변경하지 못했습니다.");
    } finally {
      setPendingIds((current) => {
        const next = new Set(current);
        next.delete(item.item_id);
        return next;
      });
    }
  }

  async function deleteItem(item: CartItem) {
    if (pendingIds.has(item.item_id)) return;
    setItems((current) => current.filter((candidate) => candidate.item_id !== item.item_id));
    setUndoItem(item);
    try {
      const response = await fetch(`/api/cart/${item.item_id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
    } catch (error) {
      setItems((current) => [item, ...current]);
      setUndoItem(null);
      setMessage(error instanceof Error ? error.message : "상품을 삭제하지 못했습니다.");
    }
  }

  async function undoDelete() {
    if (!undoItem) return;
    const item = undoItem;
    setUndoItem(null);
    setItems((current) => [item, ...current]);
    const response = await fetch(`/api/cart/${item.item_id}/restore`, { method: "POST" });
    if (!response.ok) {
      setItems((current) => current.filter((candidate) => candidate.item_id !== item.item_id));
      setMessage("삭제를 되돌리지 못했습니다.");
    }
  }

  async function completePurchase() {
    setCompletingPurchase(true);
    setMessage("");
    try {
      const response = await fetch("/api/cart/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryType: tab }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setItems([]);
      setCompletedCount(body.purchase.item_count);
      setShowCompleteDialog(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "구매 완료 처리에 실패했습니다.");
    } finally {
      setCompletingPurchase(false);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthenticated(false);
    setItems([]);
  }

  if (authenticated === null) {
    return <main className="shell loading-screen"><span className="spinner" /> 불러오는 중</main>;
  }

  if (!authenticated) {
    return (
      <main className="shell login">
        <section className="panel login-panel">
          <p className="eyebrow">우리집 쇼핑 메모</p>
          <h1>고메 Wisely 장바구니</h1>
          <p className="muted">함께 사용할 숫자 4자리 PIN을 입력하세요.</p>
          <form onSubmit={login}>
            <label htmlFor="pin">공용 PIN</label>
            <input id="pin" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="current-password" maxLength={4} pattern="\d{4}" required autoFocus />
            <button className="button primary wide" disabled={busy || pin.length !== 4}>
              {busy && <span className="spinner" />}{busy ? "확인 중" : "들어가기"}
            </button>
          </form>
          {message && <p className="error" role="alert">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header>
        <div><p className="eyebrow">우리집 쇼핑 메모</p><h1>고메 Wisely 장바구니</h1></div>
        <div className="header-actions">
          <a className="button ghost compact" href="https://shop.wisely.store" target="_blank" rel="noopener noreferrer">
            <Image src="/wisely-favicon.png" alt="" width={20} height={20} />
            와이즐리 바로가기
          </a>
          <button className="button ghost compact" onClick={logout}>로그아웃</button>
        </div>
      </header>

      <nav className="tabs" aria-label="배송 유형">
        {(["ambient", "fresh"] as const).map((value) => (
          <button key={value} className={tab === value ? "active" : ""} aria-pressed={tab === value} onClick={() => setTab(value)}>
            {value === "ambient" ? "상온배송" : "신선배송"}
          </button>
        ))}
      </nav>

      <section className="panel add-panel">
        <form onSubmit={addItem}>
          <label htmlFor="item">제품명 또는 와이즐리 URL</label>
          <input id="item" value={inputValue} onChange={(event) => setInputValue(event.target.value)} placeholder="필요한 제품을 빠르게 적어보세요" required />
          <div className="add-row">
            <div className="quantity-row"><span>수량</span><QuantityStepper value={quantity} onChange={setQuantity} /></div>
            <button className="button primary" disabled={busy}>{busy && <span className="spinner" />}{busy ? "추가 중" : "장바구니에 추가"}</button>
          </div>
        </form>
        {message && <p className="error" role="alert">{message}</p>}
      </section>

      <section className="list" aria-live="polite">
        {items.length === 0 ? (
          <div className="empty"><h2>{tab === "ambient" ? "상온배송" : "신선배송"} 목록이 비어 있습니다</h2><p>필요한 제품명이나 와이즐리 URL을 추가해보세요.</p></div>
        ) : items.map((item) => {
          const pending = pendingIds.has(item.item_id);
          return (
            <article className={`item-row${pending ? " pending" : ""}`} key={item.item_id}>
              <h2 title={item.item_name}>{item.item_name}</h2>
              <QuantityStepper value={item.quantity} disabled={pending} label={`${item.item_name} 수량`} onChange={(value) => void updateItem(item, { quantity: value })} />
              <div className="actions">
                {item.product_url && <a className="button ghost" href={item.product_url} target="_blank" rel="noreferrer">상품 보기</a>}
                <button className="button secondary" disabled={pending} onClick={() => void updateItem(item, { deliveryType: tab === "ambient" ? "fresh" : "ambient" })}>{tab === "ambient" ? "신선" : "상온"}으로 이동</button>
                <button className="button danger" disabled={pending} onClick={() => void deleteItem(item)}>삭제</button>
              </div>
            </article>
          );
        })}
      </section>

      {items.length > 0 && (
        <div className="list-toolbar">
          <div><strong>{tab === "ambient" ? "상온배송" : "신선배송"} 구매 준비가 끝났나요?</strong><span>현재 배송 유형의 품목만 구매 이력으로 저장합니다.</span></div>
          <button className="button primary" onClick={() => setShowCompleteDialog(true)}>{tab === "ambient" ? "상온배송" : "신선배송"} 구매 완료</button>
        </div>
      )}

      {undoItem && <div className="toast" role="status"><span>상품을 삭제했습니다.</span><button onClick={() => void undoDelete()}>실행 취소</button></div>}
      {completedCount !== null && <div className="toast" role="status"><span>{completedCount}개 품목을 구매 이력에 저장했습니다.</span><button onClick={() => setCompletedCount(null)}>확인</button></div>}

      {showCompleteDialog && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !completingPurchase) setShowCompleteDialog(false); }}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="complete-title">
            <div className="modal-icon" aria-hidden="true">✓</div>
            <h2 id="complete-title">{tab === "ambient" ? "상온배송" : "신선배송"} 구매 완료</h2>
            <p>구매 완료에 따라 {tab === "ambient" ? "상온배송" : "신선배송"} 장바구니만 초기화됩니다. 다른 배송 유형의 품목은 유지됩니다.</p>
            <div className="modal-actions">
              <button className="button ghost" disabled={completingPurchase} onClick={() => setShowCompleteDialog(false)}>취소</button>
              <button className="button primary" disabled={completingPurchase} onClick={() => void completePurchase()}>{completingPurchase && <span className="spinner" />}{completingPurchase ? "처리 중" : "완료"}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function QuantityStepper({ value, onChange, disabled = false, label = "수량" }: { value: number; onChange: (value: number) => void; disabled?: boolean; label?: string }) {
  return (
    <div className="stepper">
      <button type="button" className="step-button" disabled={disabled || value <= 1} onClick={() => onChange(Math.max(1, value - 1))} aria-label={`${label} 감소`}>−</button>
      <input aria-label={label} type="number" min="1" max="999" value={value} disabled={disabled} onChange={(event) => onChange(Math.max(1, Number(event.target.value)))} />
      <button type="button" className="step-button" disabled={disabled} onClick={() => onChange(value + 1)} aria-label={`${label} 증가`}>＋</button>
    </div>
  );
}
