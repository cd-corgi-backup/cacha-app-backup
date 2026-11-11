import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

// 🛠️ FUNCIÓN AUXILIAR: Convierte cualquier formato de fecha de forma segura
const parsearFecha = (fechaStr) => {
  if (!fechaStr) return new Date();
  try {
    const fechaLimpia = fechaStr.toString().replace(/Z$/, "");
    const fecha = new Date(fechaLimpia + "Z");
    return isNaN(fecha.getTime()) ? new Date() : fecha;
  } catch (e) {
    return new Date();
  }
};

export default function Historial() {
  // Añadimos los nuevos filtros al estado
  const [filtros, setFiltros] = useState({
    orden: "desc",
    desde: "",
    hasta: "",
    metodo: "Todos",
  });

  const [detalle, setDetalle] = useState(null);
  const [expandedDay, setExpandedDay] = useState(null);

  // Cargar datos
  const ventas = useLiveQuery(() => db.ventas.toArray()) || [];
  const detallesVentas = useLiveQuery(() => db.detalle_ventas.toArray()) || [];
  const facturas = useLiveQuery(() => db.facturas_ingreso.toArray()) || [];
  const detallesFacturas =
    useLiveQuery(() => db.detalle_facturas.toArray()) || [];

  // 1. Unificar todos los registros
  let todosLosRegistros = [
    ...ventas.map((v) => ({ ...v, tipoRegistro: "Venta" })),
    ...facturas.map((f) => ({ ...f, tipoRegistro: "Ingreso" })),
  ];

  // 2. APLICAR FILTROS (Fecha y Método de Pago)
  const registrosFiltrados = todosLosRegistros.filter((reg) => {
    const fechaDia = parsearFecha(reg.fecha).toLocaleDateString("en-CA");

    // Filtro por rango de fechas
    if (filtros.desde && fechaDia < filtros.desde) return false;
    if (filtros.hasta && fechaDia > filtros.hasta) return false;

    // Filtro por método de pago
    if (filtros.metodo !== "Todos") {
      // Si se filtra por método de pago, solo mostramos ventas de ese método
      // (Las facturas de ingreso se ocultan porque no tienen método de pago de venta)
      if (reg.tipoRegistro === "Venta" && reg.metodo_pago !== filtros.metodo)
        return false;
      if (reg.tipoRegistro === "Ingreso") return false;
    }

    return true;
  });

  // 3. Agrupar por Día (YYYY-MM-DD)
  const agrupadoPorDia = registrosFiltrados.reduce((acc, curr) => {
    const fechaDia = parsearFecha(curr.fecha).toLocaleDateString("en-CA");

    if (!acc[fechaDia]) {
      acc[fechaDia] = {
        fecha: fechaDia,
        ventas: [],
        compras: [],
        totalVentas: 0,
        totalCompras: 0,
      };
    }

    if (curr.tipoRegistro === "Venta") {
      acc[fechaDia].ventas.push(curr);
      acc[fechaDia].totalVentas += curr.total;
    } else {
      acc[fechaDia].compras.push(curr);
      acc[fechaDia].totalCompras += curr.total;
    }
    return acc;
  }, {});

  // 4. Convertir a array y ordenar por día
  const diasOrdenados = Object.values(agrupadoPorDia).sort((a, b) => {
    return filtros.orden === "desc"
      ? new Date(b.fecha) - new Date(a.fecha)
      : new Date(a.fecha) - new Date(b.fecha);
  });

  const toggleDay = (fecha) => {
    setExpandedDay((prev) => (prev === fecha ? null : fecha));
  };

  const abrirDetalle = (registro) => {
    if (registro.tipoRegistro === "Venta") {
      const items = detallesVentas.filter((d) => d.venta_id === registro.id);
      setDetalle({ ...registro, items });
    } else {
      const items = detallesFacturas.filter(
        (d) => d.factura_id === registro.id,
      );
      setDetalle({ ...registro, items });
    }
  };

  return (
    <div>
      <h2>Historial de Movimientos Diarios</h2>

      {/* BARRA DE FILTROS ACTUALIZADA */}
      <div className="barra-filtros">
        <div className="filtro-item">
          <label>Desde:</label>
          <input
            type="date"
            value={filtros.desde}
            onChange={(e) => setFiltros({ ...filtros, desde: e.target.value })}
          />
        </div>

        <div className="filtro-item">
          <label>Hasta:</label>
          <input
            type="date"
            value={filtros.hasta}
            onChange={(e) => setFiltros({ ...filtros, hasta: e.target.value })}
          />
        </div>

        <div className="filtro-item">
          <label>Método de Pago:</label>
          <select
            value={filtros.metodo}
            onChange={(e) => setFiltros({ ...filtros, metodo: e.target.value })}
          >
            <option value="Todos">Todos los métodos</option>
            <option value="Efectivo">💵 Efectivo</option>
            <option value="Nequi">📱 Nequi</option>
            <option value="Daviplata">📱 Daviplata</option>
            <option value="Transferencia">🏦 Transferencia</option>
          </select>
        </div>

        <div className="filtro-item">
          <label>Organizar por:</label>
          <select
            value={filtros.orden}
            onChange={(e) => setFiltros({ ...filtros, orden: e.target.value })}
          >
            <option value="desc">Días más recientes</option>
            <option value="asc">Días más antiguos</option>
          </select>
        </div>
      </div>

      {diasOrdenados.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "30px",
            color: "#7f8c8d",
            background: "white",
            borderRadius: "12px",
          }}
        >
          No hay movimientos que coincidan con los filtros.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {diasOrdenados.map((dia) => {
            const isExpanded = expandedDay === dia.fecha;
            const balance = dia.totalVentas - dia.totalCompras;

            const fechaLegible = new Date(
              dia.fecha + "T12:00:00",
            ).toLocaleDateString("es-CO", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            });

            return (
              <div
                key={dia.fecha}
                style={{
                  background: "white",
                  borderRadius: "12px",
                  border: "1px solid #e0e6ed",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.04)",
                  overflow: "hidden",
                }}
              >
                {/* CABECERA DEL DÍA */}
                <div
                  onClick={() => toggleDay(dia.fecha)}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "15px 20px",
                    cursor: "pointer",
                    backgroundColor: isExpanded ? "#f0f8ff" : "white",
                    borderBottom: isExpanded ? "1px solid #e0e6ed" : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      minWidth: "200px",
                    }}
                  >
                    <span style={{ fontSize: "20px" }}>
                      {isExpanded ? "📂" : "📁"}
                    </span>
                    <strong
                      style={{
                        fontSize: "18px",
                        color: "#2c3e50",
                        textTransform: "capitalize",
                      }}
                    >
                      {fechaLegible}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "20px",
                      flexWrap: "wrap",
                      fontSize: "14px",
                      marginTop: "10px",
                    }}
                  >
                    <div
                      style={{ color: "var(--success)", fontWeight: "bold" }}
                    >
                      Ventas: +${dia.totalVentas.toFixed(2)}
                    </div>
                    {/* Ocultamos el total de compras si el filtro de método está activo */}
                    {filtros.metodo === "Todos" && (
                      <div
                        style={{ color: "var(--purple)", fontWeight: "bold" }}
                      >
                        Compras: -${dia.totalCompras.toFixed(2)}
                      </div>
                    )}
                    <div
                      style={{
                        padding: "2px 10px",
                        borderRadius: "5px",
                        backgroundColor: balance >= 0 ? "#d4edda" : "#f8d7da",
                        color: balance >= 0 ? "#155724" : "#721c24",
                        fontWeight: "bold",
                      }}
                    >
                      Balance: ${balance.toFixed(2)}
                    </div>
                  </div>
                </div>

                {/* DETALLE DEL DÍA */}
                {isExpanded && (
                  <div style={{ padding: "15px" }}>
                    <div
                      className="table-responsive"
                      style={{ margin: 0, border: "none" }}
                    >
                      <table style={{ minWidth: "100%", margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Tipo</th>
                            <th>Hora</th>
                            <th>Detalle / Representante</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...dia.ventas, ...dia.compras]
                            .sort(
                              (a, b) =>
                                parsearFecha(a.fecha) - parsearFecha(b.fecha),
                            )
                            .map((reg) => {
                              const esIngreso = reg.tipoRegistro === "Ingreso";
                              const fechaReg = parsearFecha(reg.fecha);
                              const horaFormateada =
                                fechaReg.toLocaleTimeString("es-CO", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                });

                              return (
                                <tr
                                  key={`${reg.tipoRegistro}-${reg.id}`}
                                  onClick={() => abrirDetalle(reg)}
                                  style={{ cursor: "pointer" }}
                                >
                                  <td>
                                    <span
                                      className={
                                        esIngreso
                                          ? "badge-ingreso"
                                          : "badge-pago"
                                      }
                                      style={
                                        esIngreso
                                          ? {
                                              backgroundColor: "#d1c4e9",
                                              color: "#4a148c",
                                            }
                                          : {}
                                      }
                                    >
                                      {esIngreso
                                        ? "FACTURA DE INGRESO"
                                        : "VENTA"}
                                    </span>
                                  </td>
                                  <td>{horaFormateada}</td>
                                  <td>
                                    {esIngreso
                                      ? `Facturación: ${reg.representante || "No registrado"}`
                                      : `Venta #${reg.id} (${reg.metodo_pago})`}
                                  </td>
                                  <td
                                    style={{
                                      color: esIngreso
                                        ? "var(--purple)"
                                        : "var(--success)",
                                      fontWeight: "bold",
                                    }}
                                  >
                                    {esIngreso ? "-" : "+"}${reg.total}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL DE DETALLE */}
      {detalle && (
        <div className="modal-overlay active">
          <div className="modal-contenido">
            <h3>
              {detalle.tipoRegistro === "Ingreso"
                ? "📦 Factura de Ingreso"
                : "🛒 Venta"}{" "}
              #{detalle.id}
            </h3>
            <p>{parsearFecha(detalle.fecha).toLocaleString("es-CO")}</p>

            {detalle.tipoRegistro === "Ingreso" && (
              <p
                style={{
                  backgroundColor: "#f3e5f5",
                  padding: "10px",
                  borderRadius: "5px",
                  color: "#8e44ad",
                  fontWeight: "bold",
                }}
              >
                Representante: {detalle.representante || "No registrado"}
              </p>
            )}

            <div className="table-responsive">
              <table style={{ marginTop: "10px", marginBottom: "20px" }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Cant</th>
                    <th>Precio U.</th>
                  </tr>
                </thead>
                <tbody>
                  {detalle.items.map((d, i) => (
                    <tr key={i}>
                      <td>{d.nombre_producto}</td>
                      <td>{d.cantidad}</td>
                      <td>${d.precio_unitario}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3
              style={{
                color:
                  detalle.tipoRegistro === "Ingreso"
                    ? "var(--purple)"
                    : "var(--success)",
              }}
            >
              Total: ${detalle.total}
            </h3>

            <div className="modal-botones">
              <button className="btn-primario" onClick={() => setDetalle(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
