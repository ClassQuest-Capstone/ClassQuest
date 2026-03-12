import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import feather from "feather-icons";
import DropDownProfile from "../features/teacher/dropDownProfile.js";
import ProfileModal from "../features/teacher/ProfileModal.js";

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
    const [loading, setIsLoading] = useState(false); // Loading state
    const [teacher, setTeacher] = useState<TeacherUser | null>(null);
    const [shopType, setShopType] = useState("");
    const [price, setPrice] = useState("");
    const [shopImage, setShopImage] = useState<File | null>(null);
    const [shopLevel, setShopLevel] = useState("");
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("Shop Items");
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
    })
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
    const handleCreateQuest = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        // TODO: Send reward data to API
        console.log({
            shopType,
            price,
            shopLevel,
            shopImage
        });
        // Reset form
        setShopType("");
        setPrice("");
        setShopLevel("");
        setShopImage(null);
        setIsModalOpen(false);
    }
    

    return (
        <div className="font-poppins bg-[url(/assets/background-teacher-dash.png)] bg-cover bg-center bg-no-repeat min-h-screen">
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
                     {/* Tabs */}
                    <div className="mb-6 flex justify-center ">
                      <nav className="flex space-x-8 ">
                        <button className={tabClass("Shop Items")} onClick={() => setActiveTab("Shop Items")}>
                          Shop Items
                        </button>
                        <button className={tabClass("Student Requests")} onClick={() => setActiveTab("Student Requests")}>
                          Student Requests
                        </button>
                      </nav>
                    </div>

                    {/** Categories*/}
            {activeTab === "Shop Items" && (
              <>
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
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200"></tbody>
                </table>
             </div>
                </div>
              </>
             )}
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
                      placeholder="Enter item type. e.g 5mins Phone Time"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>
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
                      htmlFor="shopImage"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Item Image
                    </label>

                    <button type="button">
                      <label
                        htmlFor="shopImage"
                        className="w-full flex flex-col items-center px-4 py-2 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-gray-400"
                      >
                        <i data-feather="upload-cloud" className="w-6 h-6 mb-2"></i>
                        <span className="text-sm text-gray-600">Upload Image</span>
                      </label>
                      <input
                        type="file"
                        id="shopImage"
                        accept="image/*"
                        onChange={(e) => setShopImage(e.target.files![0])}
                        className="hidden"
                      />
                    </button>
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

          {/* Profile Modal */}
          <ProfileModal
            isOpen={isProfileModalOpen}
            onClose={() => setIsProfileModalOpen(false)}
          />
        </div>
    );
}

export default rewards;