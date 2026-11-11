import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../db";

export default function Fiados() {
  const [cliente, setCliente] = useState("");
  const [monto, setMonto] = useState("");

  // Estado para controlar qué clientes están expandidos
  const [expanded, setExpanded] = useState({});

  // Estado para el Modal de Aumentar / Abonar
  const [modalAction, setModalAction] = useState(null);
  const [modalAmount, setModalAmount] = useState("");

  const fiados = useLiveQuery(() => db.fiados.toArray()) || [];

  const agregarFiado = async () => {
    if (!cliente.trim() || !monto)
      return alert("Llene los campos correctamente");

    const montoIngresado = parseFloat(monto);
    const clienteLimpio = cliente.trim();

    // Obtenemos la fecha de hoy en formato YYYY-MM-DD para comparar solo el día
    const hoy = new Date().toLocaleDateString("en-CA");

    // Buscamos si este cliente ya tiene un fiado registrado HOY
    const fiadoExistente = fiados.find(
      (f) =>
        f.cliente.trim() === clienteLimpio &&
        new Date(f.fecha).toLocaleDateString("en-CA") === hoy,
    );

    if (fiadoExistente) {
      // Si existe, le sumamos el nuevo monto a la deuda de esa fecha
      await db.fiados.update(fiadoExistente.id, {
        monto: fiadoExistente.monto + montoIngresado,
      });
      alert(
        `✅ Se sumaron $${montoIngresado} a la deuda de hoy de ${clienteLimpio}`,
      );
    } else {
      // Si no existe, creamos un registro nuevo con la hora actual
      await db.fiados.add({
        cliente: clienteLimpio,
        monto: montoIngresado,
        fecha: new Date().toISOString(),
      });
    }

    setCliente("");
    setMonto("");
  };

  const toggleExpand = (nombreCliente) => {
    setExpanded((prev) => ({
      ...prev,
      [nombreCliente]: !prev[nombreCliente],
    }));
  };

  // --- ACCIONES DE LA TABLA ---
  const salvarDeuda = async (id) => {
    if (
      window.confirm("¿Dar paz y salvo a esta fecha? Se eliminará de la lista.")
    ) {
      await db.fiados.delete(id);
    }
  };

  const eliminarClienteCompleto = async (e, nombreCliente) => {
    e.stopPropagation();
    if (window.confirm(`¿Eliminar TODAS las deudas de ${nombreCliente}?`)) {
      const itemsAEliminar = fiados.filter(
        (f) => f.cliente.trim() === nombreCliente,
      );
      for (let item of itemsAEliminar) {
        await db.fiados.delete(item.id);
      }
    }
  };

  const abrirModal = (e, item, type) => {
    e.stopPropagation();
    setModalAction({
      id: item.id,
      type,
      currentAmount: item.monto,
      cliente: item.cliente,
    });
    setModalAmount("");
  };

  const confirmarModificacion = async () => {
    const val = parseFloat(modalAmount);
    if (isNaN(val) || val <= 0)
      return alert("Ingrese un monto válido mayor a 0");

    let nuevoMonto =
      modalAction.type === "aumentar"
        ? modalAction.currentAmount + val
        : modalAction.currentAmount - val;

    if (nuevoMonto < 0)
      return alert("El abono no puede ser mayor a la deuda de esta fecha.");

    if (nuevoMonto === 0) {
      await db.fiados.delete(modalAction.id);
      alert("✅ Deuda saldada.");
    } else {
      await db.fiados.update(modalAction.id, { monto: nuevoMonto });
    }

    setModalAction(null);
  };

  // --- AGRUPACIÓN Y CÁLCULO DE TOTALES ---
  const agrupados = fiados.reduce((acc, curr) => {
    const nombre = curr.cliente.trim();
    if (!acc[nombre]) {
      acc[nombre] = { cliente: nombre, total: 0, items: [] };
    }
    acc[nombre].total += curr.monto;
    acc[nombre].items.push(curr);
    return acc;
  }, {});

  const clientesOrdenados = Object.values(agrupados).sort(
    (a, b) => b.total - a.total,
  );

  return (
    <div>
      <div className="card">
        <h2>Registrar Nuevo Fiado</h2>
        <div className="form-grid">
          <input
            type="text"
            placeholder="Nombre del cliente"
            value={cliente}
            onChange={(e) => setCliente(e.target.value)}
          />
          <input
            type="number"
            placeholder="Monto a fiar ($)"
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
          />
        </div>
        <button className="btn-primario" onClick={agregarFiado}>
          Anotar Fiado
        </button>
      </div>

      <h2>Deudas Pendientes (Toca para ver detalle)</h2>

      {clientesOrdenados.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "30px",
            color: "#7f8c8d",
            background: "white",
            borderRadius: "12px",
            border: "1px solid #e0e6ed",
          }}
        >
          No hay deudas pendientes. ¡Todo al día!
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "15px",
            marginTop: "15px",
          }}
        >
          {clientesOrdenados.map((c) => {
            const isExpanded = expanded[c.cliente];

            return (
              <div
                key={c.cliente}
                style={{
                  background: "white",
                  borderRadius: "12px",
                  border: "1px solid #e0e6ed",
                  boxShadow: "0 4px 15px rgba(0,0,0,0.04)",
                  overflow: "hidden",
                }}
              >
                {/* CABECERA DEL CLIENTE (RESUMEN) */}
                <div
                  onClick={() => toggleExpand(c.cliente)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "15px 20px",
                    backgroundColor: isExpanded ? "#f0f8ff" : "white",
                    cursor: "pointer",
                    borderBottom: isExpanded ? "1px solid #e0e6ed" : "none",
                    transition: "background-color 0.2s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontSize: "20px" }}>
                      {isExpanded ? "📂" : "📁"}
                    </span>
                    <strong style={{ fontSize: "18px", color: "#2c3e50" }}>
                      {c.cliente}
                    </strong>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "15px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "18px",
                        fontWeight: "bold",
                        color: "#e74c3c",
                      }}
                    >
                      Total: ${c.total.toFixed(2)}
                    </span>
                    <button
                      className="btn-accion btn-eliminar"
                      onClick={(e) => eliminarClienteCompleto(e, c.cliente)}
                      title="Eliminar cliente de la lista"
                      style={{ margin: 0 }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>

                {/* DETALLES EXPANDIDOS */}
                {isExpanded && (
                  <div
                    className="table-responsive"
                    style={{ margin: 0, border: "none", borderRadius: 0 }}
                  >
                    <table style={{ minWidth: "100%", margin: 0 }}>
                      <thead>
                        <tr>
                          <th>Fecha y Hora</th>
                          <th>Monto Fiado</th>
                          <th style={{ textAlign: "right" }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Usamos [...c.items] para no mutar el arreglo original al ordenar */}
                        {[...c.items]
                          .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
                          .map((item) => (
                            <tr key={item.id}>
                              <td>
                                {new Date(item.fecha).toLocaleString("es-CO")}
                              </td>
                              <td style={{ fontWeight: "bold" }}>
                                ${item.monto}
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <button
                                  className="btn-accion btn-sumar"
                                  onClick={(e) =>
                                    abrirModal(e, item, "aumentar")
                                  }
                                  title="Aumentar deuda"
                                  style={{
                                    fontSize: "12px",
                                    padding: "6px 10px",
                                  }}
                                >
                                  Aumentar
                                </button>
                                <button
                                  className="btn-accion btn-restar"
                                  onClick={(e) => abrirModal(e, item, "abonar")}
                                  title="Abonar a la deuda"
                                  style={{
                                    fontSize: "12px",
                                    padding: "6px 10px",
                                  }}
                                >
                                  Abonar
                                </button>
                                <button
                                  className="btn-accion btn-editar"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    salvarDeuda(item.id);
                                  }}
                                  title="Paz y salvo"
                                  style={{
                                    fontSize: "12px",
                                    padding: "6px 10px",
                                  }}
                                >
                                  Salvar
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL FLOTANTE PARA AUMENTAR / ABONAR */}
      {modalAction && (
        <div className="modal-overlay active">
          <div className="modal-contenido">
            <h3>
              {modalAction.type === "aumentar"
                ? "➕ Aumentar Deuda"
                : "➖ Abonar a la Deuda"}
            </h3>
            <p style={{ marginBottom: "15px" }}>
              Cliente: <strong>{modalAction.cliente}</strong>
              <br />
              Monto actual de esta fecha:{" "}
              <strong>${modalAction.currentAmount}</strong>
            </p>

            <input
              type="number"
              placeholder="Ingrese el monto ($)"
              value={modalAmount}
              onChange={(e) => setModalAmount(e.target.value)}
              style={{
                fontSize: "20px",
                textAlign: "center",
                marginBottom: "20px",
              }}
              autoFocus
            />

            <div className="modal-botones">
              <button
                className="btn-cancelar"
                onClick={() => setModalAction(null)}
              >
                Cancelar
              </button>
              <button className="btn-primario" onClick={confirmarModificacion}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
