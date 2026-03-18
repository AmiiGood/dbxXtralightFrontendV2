import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
  CheckCircle,
  Search,
} from "lucide-react";
import { useAuthStore } from "../../stores/auth.store";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";

const emptyForm = {
  turnoId: "",
  areaProduccionId: "",
  sku: "",
  skuLabel: "",
  paresProducidos: "",
  fechaProduccion: new Date().toISOString().split("T")[0],
};

const emptyFilters = {
  fechaInicio: "",
  fechaFin: "",
  turnoId: "",
  areaProduccionId: "",
  sku: "",
};

export default function EnsamblePage() {
  const { user } = useAuthStore();
  const [registros, setRegistros] = useState([]);
  const [catalogos, setCatalogos] = useState({ turnos: [], areasProduccion: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [filters, setFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);
  const [pagination, setPagination] = useState({ total: 0, limit: 10, offset: 0, pages: 0 });
  const [error, setError] = useState("");

  // SKU autocomplete
  const [skuSearch, setSkuSearch] = useState("");
  const [skuResults, setSkuResults] = useState([]);
  const [skuLoading, setSkuLoading] = useState(false);
  const [showSkuDropdown, setShowSkuDropdown] = useState(false);
  const [skuConfirmed, setSkuConfirmed] = useState(false);
  const skuRef = useRef(null);

  const fetchCatalogos = async () => {
    try {
      const res = await api.get("/defectos/catalogos");
      if (res.data.status === "success") {
        setCatalogos({
          turnos: res.data.data.turnos,
          areasProduccion: res.data.data.areasProduccion,
        });
      }
    } catch (e) {
      console.error("Error cargando catálogos:", e);
    }
  };

  const fetchRegistros = useCallback(async (currentFilters, offset = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("limit", "10");
      params.append("offset", offset.toString());
      if (currentFilters.fechaInicio)      params.append("fechaInicio", currentFilters.fechaInicio);
      if (currentFilters.fechaFin)         params.append("fechaFin", currentFilters.fechaFin);
      if (currentFilters.turnoId)          params.append("turnoId", currentFilters.turnoId);
      if (currentFilters.areaProduccionId) params.append("areaProduccionId", currentFilters.areaProduccionId);
      if (currentFilters.sku)              params.append("sku", currentFilters.sku);

      const res = await api.get(`/ensamble?${params.toString()}`);
      if (res.data.status === "success") {
        setRegistros(res.data.data.registros);
        setPagination((prev) => ({ ...prev, ...res.data.data.pagination, offset }));
      }
    } catch (e) {
      console.error("Error cargando registros:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCatalogos();
    fetchRegistros(emptyFilters, 0);
  }, []);

  // Debounce búsqueda parcial para autocomplete
  useEffect(() => {
    if (!skuSearch.trim() || skuSearch.length < 2) {
      setSkuResults([]);
      setShowSkuDropdown(false);
      return;
    }
    if (skuConfirmed) return;

    const timer = setTimeout(async () => {
      setSkuLoading(true);
      try {
        // ?q= → búsqueda parcial, retorna { productos: [...] }
        const res = await api.get(`/ensamble/buscar-sku?q=${encodeURIComponent(skuSearch)}`);
        const productos = res.data?.data?.productos || [];
        setSkuResults(productos);
        setShowSkuDropdown(true);
      } catch {
        setSkuResults([]);
      } finally {
        setSkuLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [skuSearch, skuConfirmed]);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    const handler = (e) => {
      if (skuRef.current && !skuRef.current.contains(e.target)) {
        setShowSkuDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelectSku = (producto) => {
    setFormData((p) => ({ ...p, sku: producto.sku }));
    setSkuSearch(
      `${producto.sku}${producto.style_name ? ` — ${producto.style_name}` : ""}${producto.color ? ` · ${producto.color}` : ""}${producto.size ? ` · T${producto.size}` : ""}`
    );
    setSkuConfirmed(true);
    setShowSkuDropdown(false);
    setSkuResults([]);
  };

  const handleClearSku = () => {
    setFormData((p) => ({ ...p, sku: "" }));
    setSkuSearch("");
    setSkuConfirmed(false);
    setSkuResults([]);
    setShowSkuDropdown(false);
  };

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    fetchRegistros(filters, 0);
  };

  const handleClearFilters = () => {
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    fetchRegistros(emptyFilters, 0);
  };

  const handlePageChange = (newOffset) => {
    setPagination((prev) => ({ ...prev, offset: newOffset }));
    fetchRegistros(appliedFilters, newOffset);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const payload = {
        turnoId: parseInt(formData.turnoId),
        areaProduccionId: parseInt(formData.areaProduccionId),
        sku: formData.sku.trim().toUpperCase(),
        paresProducidos: parseInt(formData.paresProducidos),
        fechaProduccion: formData.fechaProduccion,
      };

      if (editingId) {
        await api.put(`/ensamble/${editingId}`, payload);
      } else {
        await api.post("/ensamble", payload);
      }

      setShowModal(false);
      resetForm();
      fetchRegistros(appliedFilters, pagination.offset);
    } catch (e) {
      setError(e.response?.data?.message || "Error al guardar");
    }
  };

  const handleEdit = (registro) => {
    setEditingId(registro.id);
    const skuLabel = registro.style_name
      ? `${registro.sku} — ${registro.style_name}${registro.color ? ` · ${registro.color}` : ""}${registro.size ? ` · T${registro.size}` : ""}`
      : registro.sku;
    setFormData({
      turnoId: registro.turno_id?.toString() || "",
      areaProduccionId: registro.area_produccion_id?.toString() || "",
      sku: registro.sku || "",
      skuLabel,
      paresProducidos: registro.pares_producidos?.toString() || "",
      fechaProduccion: registro.fecha_produccion?.split("T")[0] || new Date().toISOString().split("T")[0],
    });
    setSkuSearch(skuLabel);
    setSkuConfirmed(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar este registro de producción?")) return;
    try {
      await api.delete(`/ensamble/${id}`);
      fetchRegistros(appliedFilters, pagination.offset);
    } catch (e) {
      alert(e.response?.data?.message || "Error al eliminar");
    }
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setSkuSearch("");
    setSkuConfirmed(false);
    setSkuResults([]);
    setEditingId(null);
    setError("");
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== "");
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const getParesColor = (buenos, producidos) => {
    if (!producidos) return "";
    const pct = buenos / producidos;
    if (pct >= 0.95) return "text-green-600";
    if (pct >= 0.85) return "text-yellow-600";
    return "text-red-600";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Producción Ensamble</h2>
          <p className="text-sm text-gray-500">Registro de pares producidos por SKU</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }}>
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Registro
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Input type="date" label="Fecha Inicio" value={filters.fechaInicio}
            onChange={(e) => setFilters((p) => ({ ...p, fechaInicio: e.target.value }))} />
          <Input type="date" label="Fecha Fin" value={filters.fechaFin}
            onChange={(e) => setFilters((p) => ({ ...p, fechaFin: e.target.value }))} />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Turno</label>
            <select className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.turnoId} onChange={(e) => setFilters((p) => ({ ...p, turnoId: e.target.value }))}>
              <option value="">Todos</option>
              {catalogos.turnos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Área</label>
            <select className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
              value={filters.areaProduccionId} onChange={(e) => setFilters((p) => ({ ...p, areaProduccionId: e.target.value }))}>
              <option value="">Todas</option>
              {catalogos.areasProduccion.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
            </select>
          </div>
          <Input label="SKU" placeholder="Buscar por SKU" value={filters.sku}
            onChange={(e) => setFilters((p) => ({ ...p, sku: e.target.value }))} />
        </div>
        <div className="flex items-center justify-end gap-3 mt-4">
          {hasActiveFilters && (
            <Button variant="ghost" onClick={handleClearFilters}>
              <X className="w-4 h-4 mr-2" />Limpiar
            </Button>
          )}
          <Button onClick={handleApplyFilters}>
            <Filter className="w-4 h-4 mr-2" />Aplicar Filtros
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {["Fecha Prod.", "Turno", "Área", "SKU", "Producto", "Producidos", "Defectivos", "Buenos", "Registrado por", "Acciones"].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-xs font-semibold text-gray-500 uppercase ${i >= 5 && i <= 7 ? "text-center" : i === 9 ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">Cargando...</td></tr>
              ) : registros.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-gray-500">No hay registros</td></tr>
              ) : (
                registros.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {new Date(r.fecha_produccion).toLocaleDateString("es-MX", { timeZone: "UTC" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">{r.turno}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">{r.area_produccion}</td>
                    <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">{r.sku}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {r.style_name
                        ? `${r.style_name}${r.color ? ` · ${r.color}` : ""}${r.size ? ` · T${r.size}` : ""}`
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-center">{r.pares_producidos}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-center">
                      <span className={r.pares_defectivos > 0 ? "text-red-600" : "text-gray-400"}>{r.pares_defectivos}</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-center">
                      <span className={getParesColor(r.pares_buenos, r.pares_producidos)}>{r.pares_buenos}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.registrado_por_nombre}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => handleEdit(r)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {user?.rol?.esAdmin && (
                          <button onClick={() => handleDelete(r.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pagination.pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Mostrando {pagination.offset + 1} a {Math.min(pagination.offset + pagination.limit, pagination.total)} de {pagination.total}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => handlePageChange(pagination.offset - pagination.limit)}
                disabled={pagination.offset === 0}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-700">Página {currentPage} de {pagination.pages}</span>
              <button onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                disabled={currentPage >= pagination.pages}
                className="p-2 rounded-lg border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingId ? "Editar Producción" : "Registrar Producción"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input type="date" label="Fecha de Producción" required
                value={formData.fechaProduccion}
                onChange={(e) => setFormData((p) => ({ ...p, fechaProduccion: e.target.value }))} />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Turno</label>
                  <select required
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={formData.turnoId} onChange={(e) => setFormData((p) => ({ ...p, turnoId: e.target.value }))}>
                    <option value="">Seleccionar</option>
                    {catalogos.turnos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Área</label>
                  <select required
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                    value={formData.areaProduccionId} onChange={(e) => setFormData((p) => ({ ...p, areaProduccionId: e.target.value }))}>
                    <option value="">Seleccionar</option>
                    {catalogos.areasProduccion.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
              </div>

              {/* SKU Autocomplete */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">SKU</label>
                <div className="relative" ref={skuRef}>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Escribe SKU o nombre de producto..."
                    className={`w-full pl-10 pr-10 py-2.5 rounded-lg border bg-white text-gray-900 focus:ring-2 focus:ring-primary/20 transition-colors ${
                      skuConfirmed ? "border-green-400 focus:border-green-400" : "border-gray-300 focus:border-primary"
                    }`}
                    value={skuSearch}
                    onChange={(e) => {
                      setSkuSearch(e.target.value);
                      setSkuConfirmed(false);
                      setFormData((p) => ({ ...p, sku: "" }));
                    }}
                    onFocus={() => { if (skuResults.length > 0) setShowSkuDropdown(true); }}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {skuConfirmed ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : skuSearch ? (
                      <button type="button" onClick={handleClearSku}>
                        <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                      </button>
                    ) : null}
                  </div>

                  {showSkuDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
                      {skuLoading ? (
                        <div className="px-4 py-3 text-sm text-gray-400">Buscando...</div>
                      ) : skuResults.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-400">Sin coincidencias</div>
                      ) : (
                        skuResults.map((producto) => (
                          <button key={producto.sku} type="button"
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                            onClick={() => handleSelectSku(producto)}>
                            <span className="block text-sm font-mono font-semibold text-gray-900">{producto.sku}</span>
                            <span className="block text-xs text-gray-500 mt-0.5">
                              {producto.style_name}{producto.color && ` · ${producto.color}`}{producto.size && ` · Talla ${producto.size}`}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {skuSearch.length >= 2 && !skuConfirmed && !skuLoading && (
                  <p className="mt-1 text-xs text-gray-400">Selecciona un resultado de la lista</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pares Producidos</label>
                <input type="text" inputMode="numeric" pattern="[0-9]*" required
                  placeholder="Cantidad de pares"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-gray-900 focus:border-primary focus:ring-2 focus:ring-primary/20"
                  value={formData.paresProducidos}
                  onChange={(e) => setFormData((p) => ({ ...p, paresProducidos: e.target.value.replace(/\D/g, "") }))} />
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowModal(false)}>Cancelar</Button>
                <Button type="submit"
                  disabled={!formData.turnoId || !formData.areaProduccionId || !formData.sku || !formData.paresProducidos}>
                  {editingId ? "Guardar Cambios" : "Registrar"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
