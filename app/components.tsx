import { Link, Form, useNavigation } from "react-router";

import { formatDate, formatMoney, statusLabel } from "./lib/format";

export function PageHeader(props: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <header className="confirmo-page-header">
      <div>
        {props.eyebrow ? <div className="confirmo-eyebrow">{props.eyebrow}</div> : null}
        <h1>{props.title}</h1>
        {props.description ? <p>{props.description}</p> : null}
      </div>
      {props.action}
    </header>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  return <main className="confirmo-shell">{children}</main>;
}

export function StatCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <section className="confirmo-card confirmo-card-pad">
      <span className="confirmo-kpi-label">{label}</span>
      <strong className="confirmo-kpi-value">{value}</strong>
      {note ? <div className="confirmo-kpi-note">{note}</div> : null}
    </section>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone = ["confirmed", "delivered", "read", "completed"].includes(value)
    ? "success"
    : ["high", "declined", "failed", "cancelled"].includes(value)
      ? "critical"
      : ["pending", "active", "medium", "modification_requested"].includes(value)
        ? "warning"
        : "neutral";
  return <span className={`confirmo-badge confirmo-badge-${tone}`}>{statusLabel(value)}</span>;
}

export function OrdersTable({ orders, showActions = false }: { orders: any[]; showActions?: boolean }) {
  if (orders.length === 0) {
    return <div className="confirmo-empty">Nu există comenzi care să corespundă filtrului.</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="confirmo-table">
        <thead><tr><th>Comandă</th><th>Client</th><th>Total</th><th>Status</th><th>Risc</th><th>Creată</th>{showActions ? <th /> : null}</tr></thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td><strong>{order.orderNumber}</strong></td>
              <td>{order.customerName || "Client necunoscut"}<br /><span className="confirmo-muted">{order.customerPhone || "Fără telefon"}</span></td>
              <td>{formatMoney(order.totalAmount, order.currency)}</td>
              <td><StatusBadge value={order.confirmationStatus} /></td>
              <td><StatusBadge value={order.confirmationRiskLevel} /> <span className="confirmo-muted">{order.confirmationRiskScore}/100</span></td>
              <td>{formatDate(order.createdAt)}</td>
              {showActions ? <td><Link className="confirmo-action" to={`orders/${order.id}`}>Deschide</Link></td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LoadingButton({ children, name = "intent", value = "save" }: { children: React.ReactNode; name?: string; value?: string }) {
  const navigation = useNavigation();
  return <button className="confirmo-action confirmo-action-primary" type="submit" name={name} value={value} disabled={navigation.state === "submitting"}>{navigation.state === "submitting" ? "Saving…" : children}</button>;
}

export { Form };
