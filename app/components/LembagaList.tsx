import React from 'react';

interface LembagaItem {
  id: string;
  name: string;
  iconUrl?: string;
}

// Dummy data; replace with real data source or fetch from API.
const lembagaData: LembagaItem[] = [
  { id: 'bpd', name: 'BPD (Badan Permusyawaratan Desa)', iconUrl: '/icons/bpd.svg' },
  { id: 'lpmd', name: 'LPMD (Lembaga Pemberdayaan Masyarakat Desa)', iconUrl: '/icons/lpmd.svg' },
  { id: 'pkk', name: 'PKK (Pemberdayaan Kesejahteraan Keluarga)', iconUrl: '/icons/pkk.svg' },
  { id: 'karang', name: 'Karang Taruna', iconUrl: '/icons/karang.svg' },
];

export const LembagaList: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Lembaga Desa</h2>
      <div className="grid grid-cols-1 gap-4">
        {lembagaData.map((lembaga) => (
          <div
            key={lembaga.id}
            className="flex items-center p-4 bg-white rounded-lg shadow-sm border border-gray-100"
          >
            <div className="w-12 h-12 flex-shrink-0 mr-4">
              {lembaga.iconUrl ? (
                <img
                  src={lembaga.iconUrl}
                  alt={`${lembaga.name} icon`}
                  className="w-full h-full object-cover rounded"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 rounded" />
              )}
            </div>
            <span className="text-gray-900 font-medium">{lembaga.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
