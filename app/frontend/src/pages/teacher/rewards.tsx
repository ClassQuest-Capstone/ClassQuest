import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.js";
import ProfileModal from "../features/teacher/ProfileModal.js";
import { createShopItem, listShopItems, activateShopItem, deactivateShopItem, updateShopItem } from "../../api/shopItems/client.js";
import type { ShopItem, CreateShopItemInput, UpdateShopItemInput } from "../../api/shopItems/types.js";
import { createShopListing, listShopListingsByItem, activateShopListing, deactivateShopListing } from "../../api/shopListings/client.js";
import type { CreateShopListingInput } from "../../api/shopListings/types.js";
import { createImageUploadUrl, uploadToS3 } from "../../api/imageUpload/client.js";
import { getAssetUrl } from "../../api/imageUpload/assetUrl.js";

type TeacherUser = {
  id: string;
  role: "teacher";
  displayName?: string;
  email?: string;
  classCode?: string;
};

type Tab = "Shop Items" | "Student Requests";

type StudentRequest = {
  id: string;
  studentName: string;
  itemName: string;
  itemPrice: number;
  requestDate: string;
  status: "pending" | "approved" | "rejected";
};

const rewards = () => {
    const navigate = useNavigate();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setIsLoading] = useState(false);
    const [teacher, setTeacher] = useState<TeacherUser | null>(null);
    const [shopType, setShopType] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState("");
    const [rarity, setRarity] = useState("");
    const [isCosmetic, setIsCosmetic] = useState("");
    const [price, setPrice] = useState("");
    const [shopImage, setShopImage] = useState<File | null>(null);
    const [shopLevel, setShopLevel] = useState("");
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("Shop Items");
    const [shopItems, setShopItems] = useState<ShopItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editData, setEditData] = useState<Partial<ShopItem> | null>(null);
    const [editImage, setEditImage] = useState<File | null>(null);
    const [editLoading, setEditLoading] = useState(false);
    const [studentRequests, setStudentRequests] = useState<StudentRequest[]>([
      // Mock data - replace with API call
      {
        id: "1",
        studentName: "John Doe",
        itemName: "5mins Phone Time",
        itemPrice: 100,
        requestDate: "2024-03-10",
        status: "pending"
      },
      {
        id: "2",
        studentName: "Jane Smith",
        itemName: "Extra Break",
        itemPrice: 250,
        requestDate: "2024-03-10",
        status: "pending"
      },
      {
        id: "3",
        studentName: "Bob Johnson",
        itemName: "5mins Phone Time",
        itemPrice: 100,
        requestDate: "2024-03-09",
        status: "approved"
      }
    ]);

    const tabClass = (tab: Tab) =>
    `py-4 px-1 text-center border-b-2 font-bold text-xl ${
      activeTab === tab
        ? "border-yellow-500 text-yellow-300"
        : "border-transparent text-white hover:text-gray-700 hover:border-gray-300"
    }`;

    const handleApproveRequest = (requestId: string) => {
      setStudentRequests(prev =>
        prev.map(req =>
          req.id === requestId ? { ...req, status: "approved" } : req
        )
      );
      // TODO: Send approval to API
    };

    const handleRejectRequest = (requestId: string) => {
      setStudentRequests(prev =>
        prev.map(req =>
          req.id === requestId ? { ...req, status: "rejected" } : req
        )
      );
      // TODO: Send rejection to API
    };

    useEffect(() => {
        feather.replace();
    });

    // Load teacher data from localStorage
    useEffect(() => {
        const currentUserJson = localStorage.getItem("cq_currentUser");
        if (currentUserJson) {
          try {
            const teacherData = JSON.parse(currentUserJson) as TeacherUser;
            setTeacher(teacherData);
          } catch (error) {
            console.error("Failed to parse teacher data from localStorage:", error);
          }
        }
    }, []);

    // Load shop items from backend
    useEffect(() => {
        const fetchShopItems = async () => {
            try {
                setLoadingItems(true);
                const result = await listShopItems();
                setShopItems(result.items || []);
            } catch (error) {
                console.error("Failed to load shop items:", error);
            } finally {
                setLoadingItems(false);
            }
        };
        fetchShopItems();
    }, []);

    const uploadImageToS3 = async (file: File): Promise<string> => {
        try {
            const currentUser = JSON.parse(localStorage.getItem("cq_currentUser") || "{}");
            const teacherId = currentUser.id || "";
            const { uploadUrl, imageAssetKey } = await createImageUploadUrl({
                teacher_id: teacherId,
                entity_type: "shop-item",
                content_type: file.type as any,
                file_size: file.size,
            });
            await uploadToS3(uploadUrl, file);
            return imageAssetKey;
        } catch (error) {
            console.error("Failed to upload image to S3:", error);
            throw error;
        }
    };

    const handleCreateQuest = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            setIsLoading(true);

            // Upload image to S3 if provided
            let imageAssetKey: string | undefined = undefined;
            if (shopImage) {
                imageAssetKey = await uploadImageToS3(shopImage);
            }

            // Generate unique IDs
            const itemId = `item-${Date.now()}`;
            const listingId = `listing-${Date.now()}`;

            // Create the shop item
            const itemInput: CreateShopItemInput = {
                item_id: itemId,
                name: shopType,
                description: description,
                category: category,
                rarity: rarity as "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY",
                gold_cost: parseInt(price, 10),
                required_level: parseInt(shopLevel, 10),
                is_cosmetic_only: isCosmetic === "true",
                sprite_path: imageAssetKey || "/items/default.png",
                is_active: false // New items start as inactive
            };

            // Call API to create item
            await createShopItem(itemInput);

            // Create corresponding shop listing
            const today = new Date();
            const availableFrom = today.toISOString().split('T')[0]; // YYYY-MM-DD format
            const farFuture = new Date(today.getFullYear() + 10, today.getMonth(), today.getDate());
            const availableTo = farFuture.toISOString().split('T')[0]; // YYYY-MM-DD format

            const listingInput: CreateShopListingInput = {
                shop_listing_id: listingId,
                item_id: itemId,
                available_from: availableFrom,
                available_to: availableTo,
                is_active: false // Match the item's active status
            };

            try {
                await createShopListing(listingInput);
            } catch (listingError) {
                console.warn("Failed to create shop listing:", listingError);
                // Continue anyway - the item was created successfully
            }

            // Refresh the shop items list
            const result = await listShopItems();
            setShopItems(result.items || []);

            // Reset form
            setShopType("");
            setDescription("");
            setCategory("");
            setRarity("");
            setIsCosmetic("");
            setPrice("");
            setShopLevel("");
            setShopImage(null);
            setIsModalOpen(false);
        } catch (error) {
            console.error("Failed to create shop item:", error);
            alert("Failed to create shop item. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleActive = async (itemId: string, currentStatus: boolean) => {
        try {
            setLoadingItems(true);
            
            // Activate or deactivate the ShopItem
            if (currentStatus) {
                // Item is currently active, deactivate it
                await deactivateShopItem(itemId);
            } else {
                // Item is not active, activate it
                await activateShopItem(itemId);
            }

            // Sync ShopListings for this item - get all listings for this item
            try {
                const listingsResult = await listShopListingsByItem(itemId);
                const listings = listingsResult.items || [];

                // Update all shop listings to match the new item status
                for (const listing of listings) {
                    if (currentStatus && listing.is_active) {
                        // Item deactivated
                        await deactivateShopListing(listing.shop_listing_id);
                    } else if (!currentStatus && !listing.is_active) {
                        // Item activated
                        await activateShopListing(listing.shop_listing_id);
                    }
                }
            } catch (listingError) {
                console.warn("Failed to sync ShopListings for item:", listingError);
                //Shop item status was updated successfully
            }
            
            // Refresh the shop items list
            const result = await listShopItems();
            setShopItems(result.items || []);
        } catch (error) {
            console.error("Failed to toggle item status:", error);
            alert("Failed to update item status. Please try again.");
        } finally {
            setLoadingItems(false);
        }
    };

    const handleEditItem = (item: ShopItem) => {
        setEditingItemId(item.item_id);
        setEditData({ ...item });
        setEditImage(null);
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditData(null);
        setEditImage(null);
    };

    const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editData || !editingItemId) return;

        try {
            setEditLoading(true);

            // Handle image if a new one was selected
            let updatedSpritePath = editData.sprite_path;
            if (editImage) {
                updatedSpritePath = await uploadImageToS3(editImage);
            }

            // Create update object
            const updateInput: UpdateShopItemInput = {
                name: editData.name,
                description: editData.description,
                category: editData.category,
                rarity: editData.rarity as "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY",
                gold_cost: editData.gold_cost,
                required_level: editData.required_level,
                is_cosmetic_only: editData.is_cosmetic_only,
                sprite_path: updatedSpritePath,
            };

            // Call API to update item
            await updateShopItem(editingItemId, updateInput);

            // Refresh the shop items list
            const result = await listShopItems();
            setShopItems(result.items || []);

            // Close modal
            handleCancelEdit();
        } catch (error) {
            console.error("Failed to update shop item:", error);
            alert("Failed to update shop item. Please try again.");
        } finally {
            setEditLoading(false);
        }
    };

    const validateImageSize = (file: File): boolean => {
        const maxSizeMB = 5;
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        return file.size <= maxSizeBytes;
    };

    const handleImageSelect = (file: File | undefined, isEdit: boolean = false) => {
        if (!file) return;

        if (!validateImageSize(file)) {
            alert(`Image size exceeds ${5}MB limit. Please select a smaller image.`);
            return;
        }

        if (isEdit) {
            setEditImage(file);
        } else {
            setShopImage(file);
        }
    };
    

    return (
        <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat h-screen overflow-y-auto">
              <nav className="bg-blue-700 text-white shadow-lg">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="flex justify-between h-16">
                    <div className="flex items-center">
                      <div className="shrink-0 flex items-center">
                        {/* Logo and Nav Links */}
                        <Link
                          to="/teacherDashboard"
                          className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600"
                        >
                          <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                          <span className="text-xl font-bold">ClassQuest</span>
                        </Link>
                      </div>
                    </div>
                    <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
                     <Link to="/teacherDashboard" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Dashboard</Link>
                      <Link to="/Classes" className="px-3 py-2 rounded-md text-sm font-medium bg-blue-900">Classes</Link>
                      <Link to="/Subjects" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Quests</Link>
                      <Link to="/Activity" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Activity</Link>
                      <Link to="/teacherGuilds" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">Guilds</Link>
                      <DropDownProfile
                                      username={teacher?.displayName || "user"}
                                      onLogout={() => {
                                        localStorage.removeItem("cq_currentUser");
                                        navigate("/TeacherLogin");
                                      }}
                                      onProfileClick={() => setIsProfileModalOpen(true)}
                                    />
                    </div>
                    <div className="-mr-2 flex items-center md:hidden">
                      <button className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-600">
                        <i data-feather="menu"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </nav>
              {/* Back button */}
                        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                          <Link to="/classes" className="inline-flex items-center bg-indigo-600 text-white border-2 border-indigo-600 rounded-md px-3 py-2 hover:bg-indigo-700">
                            <i data-feather="arrow-left" className="w-5 h-5 mr-2"></i>
                            <span className="text-sm font-medium">Back</span>
                          </Link>
                        </div>
              {/** Intro and create item */}
              <main className="max-w-7xl mx-auto px-4 py-8">
                    <div className="flex flex-wrap gap-4 justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-yellow-300">Shop Items</h1>
                        <p className="text-white">Add and manage items available for students to purchase</p>
                    </div>
                    <button
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-6 py-2 rounded-lg flex items-center"
                        onClick={() => setIsModalOpen(true)}
                    >
                        <i data-feather="plus" className="mr-2"></i> Create Items
                    </button>
                    </div>
                     {/* Tabs - Commented out since Shop Items is the only page */}
                    {/* <div className="mb-6 flex justify-center ">
                      <nav className="flex space-x-8 ">
                        <button className={tabClass("Shop Items")} onClick={() => setActiveTab("Shop Items")}>
                          Shop Items
                        </button>
                      </nav>
                    </div> */}

                    {/** Categories*/}
                    <div className="mb-8">
                      <div className="grid grid-cols-1 gap-4 text-white">
                          
                          <div className="bg-gradient-to-r from-green-300 to-green-500 rounded-lg shadow-lg p-8 text-center hover:shadow-xl transition-shadow">
                              <div className="flex items-center justify-center gap-6">
                                <div className="bg-green-50 text-green-700 rounded-full w-24 h-24 flex items-center justify-center">
                                  <i data-feather="shopping-cart" className="w-12 h-12"></i>
                              </div>
                              <div className="text-left">
                                <h3 className="text-2xl font-bold text-green-900">Shop</h3>
                                <p className="text-green-800">Create exciting in class shop items for your students</p>
                              </div>
                              </div>
                          </div>
                      </div>
                    </div>
                <div className="bg-white rounded-xl shadow-lg p-6 text-gray-900">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">All Shop Items</h2>
                {/*<div className="relative">
                    <input type="text" placeholder="Search items..." className="border border-gray-300 rounded-full px-4 py-2 pl-10 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                    <i data-feather="search" className="absolute left-3 top-2.5 text-gray-400"></i>
                </div>*/}
            </div>

            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Level</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Image</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {loadingItems ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                                    Loading shop items...
                                </td>
                            </tr>
                        ) : shopItems.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                                    No shop items created yet. Click "Create Items" to get started.
                                </td>
                            </tr>
                        ) : (
                            shopItems.map((item) => (
                                <tr key={item.item_id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        Level {item.required_level}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <img
                                            src={getAssetUrl(item.sprite_path) ?? "/assets/items/default.png"}
                                            alt={item.name}
                                            className="h-10 w-10 object-cover rounded"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Crect fill='%23ddd' width='40' height='40'/%3E%3C/svg%3E";
                                            }}
                                        />
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {item.name}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {item.description}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {item.category}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-yellow-600">
                                        {item.gold_cost} Gold
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                                        <button
                                            onClick={() => handleToggleActive(item.item_id, item.is_active)}
                                            disabled={loadingItems}
                                            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                                                item.is_active
                                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                                    : "bg-gray-200 text-gray-800 hover:bg-gray-300"
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                        >
                                            {item.is_active ? "Active" : "Activate"}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm flex gap-2">
                                        <button
                                            onClick={() => handleEditItem(item)}
                                            className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded hover:bg-blue-50"
                                            title="Edit item"
                                        >
                                            <i data-feather="edit-2" className="w-5 h-5"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
             </div>
                </div>

             {/* Commented out Student Requests section
             {activeTab === "Student Requests" && (
              <div className="bg-white rounded-xl shadow-lg p-6 text-gray-900">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold">Student Requests</h2>
                </div>

                {studentRequests.filter(req => req.status === "pending").length === 0 ? (
                  <div className="text-center py-12">
                    <i data-feather="inbox" className="w-16 h-16 mx-auto text-gray-400 mb-4"></i>
                    <p className="text-gray-500 text-lg">No pending requests</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {studentRequests.map((request) => (
                      <div
                        key={request.id}
                        className={`border rounded-lg p-4 flex justify-between items-center ${
                          request.status === "pending"
                            ? "border-yellow-300 bg-yellow-50"
                            : request.status === "approved"
                            ? "border-green-300 bg-green-50"
                            : "border-red-300 bg-red-50"
                        }`}
                      >
                        <div className="flex-1">
                          <h3 className="font-bold text-gray-900">{request.studentName}</h3>
                          <p className="text-gray-700">{request.itemName}</p>
                          <div className="flex gap-4 mt-2 text-sm text-gray-600">
                            <span className="font-medium">{request.itemPrice} Gold</span>
                            <span>{request.requestDate}</span>
                          </div>
                          <div className="mt-2">
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded-full ${
                                request.status === "pending"
                                  ? "bg-yellow-200 text-yellow-800"
                                  : request.status === "approved"
                                  ? "bg-green-200 text-green-800"
                                  : "bg-red-200 text-red-800"
                              }`}
                            >
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          </div>
                        </div>
                        {request.status === "pending" && (
                          <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-0 sm:ml-4 w-full sm:w-auto">
                            <button
                              onClick={() => handleApproveRequest(request.id)}
                              className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm flex-1 sm:flex-none"
                            >
                              <i data-feather="check" className="w-4 h-4"></i>
                              <span className="hidden sm:inline">Approve</span>
                              <span className="sm:hidden">Approve</span>
                            </button>
                            <button
                              onClick={() => handleRejectRequest(request.id)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm flex-1 sm:flex-none"
                            >
                              <i data-feather="x" className="w-4 h-4"></i>
                              <span className="hidden sm:inline">Reject</span>
                              <span className="sm:hidden">Reject</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
             )}
             */}
          </main>
          {/* Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 bg-white/300 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900">
              <div className="relative top-20 mx-auto p-5 border w-full max-w-xl shadow-lg rounded-md bg-white">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Shop Item </h2>
                
                <form onSubmit={handleCreateQuest} className="space-y-5">
                  {/* Reward Type Input */}
                 <div>
                    <label
                      htmlFor="shopType"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Item Type
                    </label>
                    <input
                      type="text"
                      id="shopType"
                      value={shopType}
                      onChange={(e) => setShopType(e.target.value)}
                      required
                      placeholder="Enter item type. e.g Phone Time"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
                  </div>
                  {/* Description Input */}
                 <div>
                    <label
                      htmlFor="description"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Description
                    </label>
                    <input
                      type="text"
                      id="description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      placeholder="Enter item description"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
                  </div>
                  {/* Category Dropdown */}
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      id="category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a category...</option>
                      <option value="CLASS_ITEMS">Class Items</option>
                      <option value="COSMETIC">Cosmetic</option>
                      <option value="POWER_UPS">Power-ups</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                   {/* Rarity Dropdown */}
                  <div>
                    <label htmlFor="Rarity" className="block text-sm font-medium text-gray-700 mb-2">
                      Rarity
                    </label>
                    <select
                      id="rarity"
                      value={rarity}
                      onChange={(e) => setRarity(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a rarity...</option>
                      <option value="COMMON">Common</option>
                      <option value="UNCOMMON">Uncommon</option>
                      <option value="RARE">Rare</option>
                      <option value="EPIC">Epic</option>
                      <option value="LEGENDARY">Legendary</option>
                    </select>
                  </div>
                  {/* Is cosmetic dropdown */}
                  <div>
                    <label htmlFor="isCosmetic" className="block text-sm font-medium text-gray-700 mb-2">
                      Is the item cosmetic only?
                    </label>
                    <select
                      id="isCosmetic"
                      value={isCosmetic}
                      onChange={(e) => setIsCosmetic(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select an option...</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  {/* Price Dropdown */}
                  <div>
                    <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                      Price (Gold)
                    </label>
                    <select
                      id="price"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a price...</option>
                      <option value="100">100</option>
                      <option value="250">250</option>
                      <option value="500">500</option>
                      <option value="750">750</option>
                      <option value="1000">1000</option>
                      <option value="1500">1500</option>
                      <option value="2000">2000</option>
                    </select>
                  </div>

                  {/* Reward Level Dropdown */}
                  <div>
                    <label htmlFor="shopLevel" className="block text-sm font-medium text-gray-700 mb-2">
                       Level
                    </label>
                    <select
                      id="shopLevel"
                      value={shopLevel}
                      onChange={(e) => setShopLevel(e.target.value)}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a level...</option>
                      <option value="5">Level 5</option>
                      <option value="10">Level 10</option>
                      <option value="15">Level 15</option>
                      <option value="20">Level 20</option>
                      <option value="25">Level 25</option>
                      <option value="30">Level 30</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="sprite_path"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Item Image
                    </label>

                    <button type="button">
                      <label
                        htmlFor="sprite_path"
                        className={`w-full flex flex-col items-center px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          shopImage
                            ? "border-green-300 bg-green-50 hover:border-green-400"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {shopImage ? (
                          <>
                            <i data-feather="check-circle" className="w-6 h-6 mb-2 text-green-600"></i>
                            <span className="text-sm font-medium text-green-700">{shopImage.name}</span>
                          </>
                        ) : (
                          <>
                            <i data-feather="upload-cloud" className="w-6 h-6 mb-2 text-gray-600"></i>
                            <span className="text-sm text-gray-600">Upload Image</span>
                          </>
                        )}
                      </label>
                      <input
                        type="file"
                        id="sprite_path"
                        accept="image/*"
                        onChange={(e) => handleImageSelect(e.target.files?.[0], false)}
                        className="hidden"
                      />
                    </button>
                    {shopImage && (
                      <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <i data-feather="check" className="w-4 h-4"></i>
                        Image selected successfully
                      </p>
                    )}
                    <p className="text-xs text-red-500 mt-2">
                      <i data-feather="alert-circle" className="w-4 h-4 inline mr-1"></i>
                      Maximum file size: 900KB
                    </p>
                  </div>


                  {/* Buttons */}
                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:bg-gray-400"
                    >
                      {loading ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsModalOpen(false);
                        setShopType("");
                        setDescription("");
                        setCategory("");
                        setRarity("");
                        setIsCosmetic("");
                        setPrice("");
                        setShopLevel("");
                        setShopImage(null);
                      }}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Modal */}
          {editingItemId && editData && (
            <div className="fixed inset-0 bg-white/300 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-start justify-center text-gray-900">
              <div className="relative top-20 mx-auto p-5 border w-full max-w-xl shadow-lg rounded-md bg-white">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Shop Item</h2>
                
                <form onSubmit={handleSaveEdit} className="space-y-5">
                  <div>
                    <label htmlFor="edit_shopType" className="block text-sm font-medium text-gray-700 mb-2">
                      Item Type
                    </label>
                    <input
                      type="text"
                      id="edit_shopType"
                      value={editData.name || ""}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      required
                      placeholder="Enter item type"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit_description" className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <input
                      type="text"
                      id="edit_description"
                      value={editData.description || ""}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      required
                      placeholder="Enter item description"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit_category" className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      id="edit_category"
                      value={editData.category || ""}
                      onChange={(e) => setEditData({ ...editData, category: e.target.value })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a category...</option>
                      <option value="CLASS_ITEMS">Class Items</option>
                      <option value="COSMETIC">Cosmetic</option>
                      <option value="POWER_UPS">Power-ups</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit_rarity" className="block text-sm font-medium text-gray-700 mb-2">
                      Rarity
                    </label>
                    <select
                      id="edit_rarity"
                      value={editData.rarity || ""}
                      onChange={(e) => setEditData({ ...editData, rarity: e.target.value as any })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select a rarity...</option>
                      <option value="COMMON">Common</option>
                      <option value="UNCOMMON">Uncommon</option>
                      <option value="RARE">Rare</option>
                      <option value="EPIC">Epic</option>
                      <option value="LEGENDARY">Legendary</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit_isCosmetic" className="block text-sm font-medium text-gray-700 mb-2">
                      Is the item cosmetic only?
                    </label>
                    <select
                      id="edit_isCosmetic"
                      value={editData.is_cosmetic_only ? "true" : "false"}
                      onChange={(e) => setEditData({ ...editData, is_cosmetic_only: e.target.value === "true" })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Select an option...</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit_price" className="block text-sm font-medium text-gray-700 mb-2">
                      Price (Gold)
                    </label>
                    <input
                      type="number"
                      id="edit_price"
                      value={editData.gold_cost || ""}
                      onChange={(e) => setEditData({ ...editData, gold_cost: parseInt(e.target.value, 10) || 0 })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit_level" className="block text-sm font-medium text-gray-700 mb-2">
                      Level
                    </label>
                    <input
                      type="number"
                      id="edit_level"
                      value={editData.required_level || ""}
                      onChange={(e) => setEditData({ ...editData, required_level: parseInt(e.target.value, 10) || 0 })}
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit_sprite_path" className="block text-sm font-medium text-gray-700 mb-2">
                      Item Image (Optional)
                    </label>
                    <button type="button">
                      <label
                        htmlFor="edit_sprite_path"
                        className={`w-full flex flex-col items-center px-4 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          editImage
                            ? "border-green-300 bg-green-50 hover:border-green-400"
                            : "border-gray-300 hover:border-gray-400"
                        }`}
                      >
                        {editImage ? (
                          <>
                            <i data-feather="check-circle" className="w-6 h-6 mb-2 text-green-600"></i>
                            <span className="text-sm font-medium text-green-700">{editImage.name}</span>
                          </>
                        ) : (
                          <>
                            <i data-feather="upload-cloud" className="w-6 h-6 mb-2 text-gray-600"></i>
                            <span className="text-sm text-gray-600">Replace Image</span>
                          </>
                        )}
                      </label>
                      <input
                        type="file"
                        id="edit_sprite_path"
                        accept="image/*"
                        onChange={(e) => handleImageSelect(e.target.files?.[0], true)}
                        className="hidden"
                      />
                    </button>
                    {editImage && (
                      <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                        <i data-feather="check" className="w-4 h-4"></i>
                        Image selected successfully
                      </p>
                    )}
                    <p className="text-xs text-red-500 mt-2">
                      <i data-feather="alert-circle" className="w-4 h-4 inline mr-1"></i>
                      Maximum file size: 900KB
                    </p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      type="submit"
                      disabled={editLoading}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg transition-colors disabled:bg-gray-400"
                    >
                      {editLoading ? "Saving..." : "Save Changes"}
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-900 font-medium py-2 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Profile Modal */}
          <ProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
          />
        </div>
    );
}

export default rewards;