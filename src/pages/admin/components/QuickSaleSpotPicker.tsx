import { SPOTS, AREA_LABELS, type Area } from '@/pages/pos/types';

interface QuickSaleSpotPickerProps {
  selected: string | null;
  onSelect: (spotId: string) => void;
  occupiedSpots: Set<string>;
}

const AREA_ORDER: Area[] = ['principal', 'af1', 'af2'];

export default function QuickSaleSpotPicker({ selected, onSelect, occupiedSpots }: QuickSaleSpotPickerProps) {
  const grouped = AREA_ORDER.map(area => ({
    area,
    label: AREA_LABELS[area],
    spots: SPOTS.filter(s => s.area === area),
  }));

  return (
    <div className="space-y-4">
      {grouped.map(({ area, label, spots }) => (
        <div key={area}>
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</h4>
          <div className="flex flex-wrap gap-2">
            {spots.map(spot => {
              const isOccupied = occupiedSpots.has(spot.id);
              const isSelected = selected === spot.id;
              return (
                <button
                  key={spot.id}
                  onClick={() => onSelect(spot.id)}
                  className={`px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer transition-all whitespace-nowrap
                    ${isSelected
                      ? 'bg-amber-500 text-white border-amber-500 ring-2 ring-amber-300'
                      : isOccupied
                        ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-amber-50 hover:border-amber-300'
                    }`}
                >
                  {isOccupied && <i className="ri-user-line mr-1 text-rose-400" />}
                  {spot.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}