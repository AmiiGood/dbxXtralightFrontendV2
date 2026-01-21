import { Settings } from "lucide-react";

export default function CatalogosPage() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <Settings className="w-8 h-8 text-gray-400" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 mb-2">Catálogos</h2>
      <p className="text-gray-500 text-center max-w-md">
        Este módulo estará disponible próximamente. Aquí podrás administrar los
        catálogos del sistema.
      </p>
    </div>
  );
}
