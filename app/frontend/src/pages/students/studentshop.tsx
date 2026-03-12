import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Menu, ChevronDown, Loader, Inbox } from "react-feather";
import { usePlayerProgression } from "../hooks/students/usePlayerProgression.js";
import { listClassShopListings, listActiveShopListings } from "../../api/shopListings/client.js";
import { listShopItems } from "../../api/shopItems/client.js";
import { grantInventoryItem } from "../../api/inventoryItems/client.js";
import { upsertPlayerState, getPlayerState } from "../../api/playerStates.js";
import type { ShopListing } from "../../api/shopListings/types.js";
import type { ShopItem } from "../../api/shopItems/types.js";

type StudentUser = {
  id: string;
  role: "student";
  displayName?: string;
  email?: string;
  classId?: string;
};

function getCurrentStudent(): StudentUser | null {
  const raw = localStorage.getItem("cq_currentUser");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.role === "student") return parsed;
  } catch {
    // ignore
  }
  return null;
}

// Map rarity tier to styling
function getRarityTier(rarity: string) {
  const rarityMap: { [key: string]: { tier: string; border: string; gradient: string; badge: string; glow: string } } = {
    "LEGENDARY": { tier: "Legendary", border: "border-yellow-400", gradient: "from-yellow-900/70 to-orange-900/70", badge: "bg-yellow-400 text-yellow-900", glow: "hover:shadow-yellow-500/50" },
    "EPIC": { tier: "Epic", border: "border-purple-500", gradient: "from-purple-900/70 to-pink-900/70", badge: "bg-purple-400 text-white", glow: "hover:shadow-purple-500/50" },
    "RARE": { tier: "Rare", border: "border-blue-400", gradient: "from-blue-900/80 to-cyan-900/80", badge: "bg-blue-400 text-white", glow: "hover:shadow-blue-500/50" },
    "UNCOMMON": { tier: "Uncommon", border: "border-green-400", gradient: "from-green-900/70 to-emerald-900/70", badge: "bg-green-400 text-green-900", glow: "hover:shadow-green-500/50" },
    "COMMON": { tier: "Common", border: "border-gray-300", gradient: "from-gray-500/70 to-gray-600/70", badge: "bg-gray-300 text-gray-700", glow: "hover:shadow-gray-400/50" },
  };
  return rarityMap[rarity] || rarityMap["COMMON"];
}

const StudentShop: React.FC = () => {
  const student = useMemo(() => getCurrentStudent(), []);
  const studentId = student?.id ?? null;
  const [classId, setClassId] = useState<string | null>(null);
  const [shopItems, setShopItems] = useState<(ShopItem & { listing_id: string })[]>([]);
  const [loading, setLoading] = useState(false);
  const [purchasingItemIds, setPurchasingItemIds] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    // From student
    if (student?.classId) {
      setClassId(student.classId);
      return;
    }
  
    // From localStorage (most important)
    const stored = localStorage.getItem("cq_currentClassId");
    if (stored) {
      setClassId(stored);
      return;
    }
  
    // Fallback → no class
    setClassId(null);
  }, [student?.classId]);
  
  const { profile } = usePlayerProgression(
    studentId || "",
    classId || ""
  );

  // Fetch shop listings and items
  useEffect(() => {
    const fetchShopItems = async () => {
      try {
        setLoading(true);
        
        // Fetch listings for the class or globally
        const listingsResult = classId
          ? await listClassShopListings(classId)
          : await listActiveShopListings();
        
        const listings = listingsResult.items || [];

        // Fetch all shop items
        const itemsResult = await listShopItems();
        const allItems = itemsResult.items || [];

        // Filter listings by is_active status and map to items
        const displayItems = listings
          .filter(listing => listing.is_active === true) // Only show active listings
          .map(listing => {
            // Find the corresponding item from ShopItems
            const item = allItems.find(i => i.item_id === listing.item_id);
            if (item) {
              return {
                ...item,
                listing_id: listing.shop_listing_id,
              };
            }
            return null;
          })
          .filter((item): item is (ShopItem & { listing_id: string }) => item !== null);

        // Sort by price (lowest to highest)
        displayItems.sort((a, b) => a.gold_cost - b.gold_cost);

        setShopItems(displayItems);
      } catch (error) {
        console.error("Failed to fetch shop items:", error);
        setShopItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchShopItems();
  }, [classId]);

  const handleBuy = async (item: ShopItem & { listing_id: string }) => {
    if (!studentId || !classId) {
      alert("Missing student or class information");
      return;
    }

    const canAfford = profile.gold >= item.gold_cost;
    const meetsLevel = item.required_level <= (profile.level || 1);
    
    if (!canAfford || !meetsLevel) {
      alert(
        !canAfford
          ? "You don't have enough gold"
          : `You need to be level ${item.required_level} to purchase this item`
      );
      return;
    }

    try {
      setPurchasingItemIds(prev => new Set(prev).add(item.item_id));

      // Get current player state to preserve XP values
      const playerState = await getPlayerState(classId, studentId);
      
      // Calculate new gold amount
      const newGoldAmount = playerState.gold - item.gold_cost;

      // Upsert player state with preserved XP and updated gold
      await upsertPlayerState(classId, studentId, {
        current_xp: playerState.current_xp,
        xp_to_next_level: playerState.xp_to_next_level,
        total_xp_earned: playerState.total_xp_earned,
        hearts: playerState.hearts,
        max_hearts: playerState.max_hearts,
        gold: newGoldAmount,
        status: "ALIVE",
      });

      // Grant item to student's inventory
      await grantInventoryItem({
        student_id: studentId,
        class_id: classId,
        item_id: item.item_id,
        quantity: 1,
        acquired_from: "SHOP_PURCHASE",
      });

      // Update local profile state
      (profile as any).gold = newGoldAmount;

      alert("Item purchased successfully!");
    } catch (error) {
      console.error("Failed to purchase item:", error);
      alert("Failed to purchase item. Please try again.");
    } finally {
      setPurchasingItemIds(prev => {
        const updated = new Set(prev);
        updated.delete(item.item_id);
        return updated;
      });
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-fixed"
      style={{
        backgroundImage:
          "url('https://i.pinimg.com/originals/df/96/29/df9629c20480fa6cb0b6241d0fdd3a47.jpg')",
      }}
    >
      {/* NAVIGATION */}
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <BookOpen className="w-8 h-8 mr-2" />
                <span className="text-xl font-bold">ClassQuest</span>
              </div>
            </div>

            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link
                to="/character"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Character
              </Link>

              <Link
                to="/guilds"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Guilds
              </Link>

              <Link
                to="/leaderboards"
                className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
              >
                Leaderboard
              </Link>
              <Link
                to="/shop"
                className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900"
              >
                Shop
              </Link>

            <div className="flex items-center ml-4">
            <Link
                to="/shop"
                className="flex items-center bg-primary-600 px-3 py-1 rounded-full hover:bg-primary-700 transition"
            >
                {/* Gold Bar Image */}
                <img
                src="/assets/icons/gold-bar.png"
                alt="Gold"
                className="h-5 w-5 mr-1"
                />

                {/* Amount */}
                <span className="text-white font-medium">
                  {profile.gold.toLocaleString()}
                  </span>
            </Link>
            </div>


              {/* Profile */}
              <div className="relative ml-3">
                <button className="flex items-center text-sm rounded-full focus:outline-none">
                  <img
                    className="h-8 w-8 rounded-full"
                    src="http://static.photos/people/200x200/8"
                    alt="profile"
                  />
                  <span className="ml-2 text-sm font-medium">{student?.displayName ?? "Student"}</span>
                </button>
              </div>
            </div>

            {/* Mobile Menu */}
            <div className="-mr-2 flex items-center md:hidden">
              <button className="inline-flex items-center justify-center p-2 rounded-md text-primary-100 hover:text-white hover:bg-primary-600">
                <Menu />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* SHOP CONTENT */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-green-500">ClassQuest Shop</h1>
            <p className="text-gray-200">
              Spend your hard-earned gold on awesome items!
            </p>
          </div>

          <div className="flex items-center bg-yellow-100 px-4 py-2 rounded-full">
            <img
                src="/assets/icons/gold-bar.png"
                alt="Gold"
                className="h-5 w-5 mr-1"
                />
            <span className="text-gray-600 font-bold">{profile.gold.toLocaleString()} Gold</span>
          </div>
        </div>

        {/* SORT AND FILTER */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-blue-500">Available Items</h2>
            <p className="text-gray-300 text-sm">Browse and purchase rewards from your teacher</p>
          </div>

          <div className="relative">
            <select className="block appearance-none bg-white/80 border border-gray-600 px-4 py-2 pr-8 rounded-full text-gray-900 shadow-sm">
              <option>Sort by: Newest</option>
              <option>Sort by: Price Low to High</option>
              <option>Sort by: Price High to Low</option>
            </select>

            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-900">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* SHOP ITEMS GRID */}
        <div className="bg-white/30 rounded-xl shadow-lg p-6 text-gray-900">
          {loading ? (
            <div className="text-center py-12">
              <Loader className="w-12 h-12 mx-auto text-gray-900 mb-3 animate-spin" />
              <p className="text-gray-700 font-medium">Loading shop items...</p>
            </div>
          ) : shopItems.length === 0 ? (
            <div className="text-center py-12">
              <Inbox className="w-12 h-12 mx-auto text-gray-900 mb-3" />
              <p className="text-gray-700 font-medium">No items available in the shop</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {shopItems.map((item) => {
                const rarity = getRarityTier(item.rarity);
                const canAfford = profile.gold >= item.gold_cost;
                const meetsLevel = item.required_level <= (profile.level || 1);
                const canBuy = canAfford && meetsLevel;

                return (
                  <div
                    key={item.item_id}
                    className={`shop-item bg-gradient-to-br ${rarity.gradient} border-2 ${rarity.border} rounded-lg transition transform hover:-translate-y-2 ${rarity.glow} hover:shadow-lg overflow-hidden`}
                  >
                    <div className="bg-gradient-to-b from-black/40 to-black/60 h-40 flex items-center justify-center overflow-hidden mb-3 border-b border-gray-700/50">
                      <img
                        src={item.sprite_path}
                        className="h-full w-full object-contain drop-shadow-lg"
                        alt={item.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='112' height='112'%3E%3Crect fill='%23333' width='112' height='112'/%3E%3Ctext x='50%25' y='50%25' font-size='12' fill='%23666' text-anchor='middle' dy='.3em'%3ENo Image%3C/text%3E%3C/svg%3E";
                        }}
                      />
                    </div>

                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="text-white font-bold text-sm flex-1">{item.name}</h3>
                        <span className={`text-xs font-bold px-2 py-1 ${rarity.badge} rounded-full`}>
                          {rarity.tier}
                        </span>
                      </div>

                      <p className="text-gray-200 text-xs mb-2 line-clamp-2">{item.description}</p>

                      <div className="text-xs text-gray-300 mb-3 flex gap-2 flex-wrap">
                       {/* <span className="inline-block bg-white/20 px-2 py-1 rounded">{item.category}</span>*/}
                        {item.required_level > 1 && (
                          <span className="inline-block bg-white/20 px-2 py-1 rounded">Lv. {item.required_level}</span>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-gray-400/30">
                        <div className="flex items-center gap-1">
                          <img
                            src="/assets/icons/gold-bar.png"
                            alt="Gold"
                            className="h-4 w-4"
                          />
                          <span className="text-white font-bold text-sm">{item.gold_cost.toLocaleString()}</span>
                        </div>

                        <button
                          disabled={!canBuy || purchasingItemIds.has(item.item_id)}
                          onClick={() => handleBuy(item)}
                          title={!canAfford ? "Not enough gold" : !meetsLevel ? `Requires Level ${item.required_level}` : "Purchase item"}
                          className="bg-yellow-400 hover:bg-yellow-500 disabled:bg-gray-500 disabled:cursor-not-allowed text-gray-900 px-3 py-1 rounded-full text-xs font-bold transition transform hover:scale-105"
                        >
                          {purchasingItemIds.has(item.item_id) ? "..." : "Buy"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentShop;
