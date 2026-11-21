"use client";

import { useState } from "react";
import { Building2, ChevronDown, HeartHandshake, Landmark, Sprout, Users } from "lucide-react";

export type ProfileInstitution = { name: string; description: string; logoUrl?: string };

const placeholderIcons = [Landmark, Users, HeartHandshake, Sprout, Building2];

export function ProfileInstitutionChips({ items }: { items: ProfileInstitution[] }) {
  const [expandedItems, setExpandedItems] = useState<number[]>([]);

  return (
    <ul className="profile-institution-list">
      {items.map((item, index) => {
        const Icon = placeholderIcons[index % placeholderIcons.length];
        const isExpanded = expandedItems.includes(index);
        return (
          <li className={`profile-institution-row${isExpanded ? " is-expanded" : ""}`} key={`${item.name}-${index}`}>
            <div className="profile-institution-row-main">
              {item.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- logo unggahan API pada static export
                <img className="profile-institution-logo" src={item.logoUrl} alt="" />
              ) : (
                <span className="profile-institution-icon" aria-hidden="true"><Icon size={21} /></span>
              )}
              <strong className="profile-institution-name">{item.name}</strong>
              <button
                aria-expanded={isExpanded}
                aria-label={`${isExpanded ? "Tutup" : "Lihat"} keterangan ${item.name}`}
                className="profile-institution-toggle"
                onClick={() => setExpandedItems((current) => (
                  isExpanded ? current.filter((expandedIndex) => expandedIndex !== index) : [...current, index]
                ))}
                type="button"
              >
                <ChevronDown size={19} aria-hidden="true" />
              </button>
            </div>
            <div className="profile-institution-description-wrap" aria-hidden={!isExpanded}>
              <p className="profile-institution-description">{item.description}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
