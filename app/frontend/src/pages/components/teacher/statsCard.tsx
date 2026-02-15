import React from "react";

interface StatsCardProps {
  icon: string;
  label: string;
  value: number | string;
}

const StatsCard: React.FC<StatsCardProps> = ({ icon, label, value }) => {
  return (
    <div className="bg-gradient-to-r from-gray-300 to-gray-400 overflow-hidden shadow rounded-lg">
      <div className="px-4 py-5 sm:p-6">
        <div className="flex items-center">
          <div className="shrink-1 bg-gradient-to-r from-pink-500 to-purple-500 rounded-md p-2">
            <i data-feather={icon} className="h-6 w-6 text-white"></i>
          </div>
          <div className="ml-5 w-0 flex-1">
            <dt className="text-md font-medium text-gray-900 truncate">
              {label}
            </dt>
            <dd className="flex items-baseline">
              <div className="text-2xl font-semibold text-gray-900">
                {value}
              </div>
            </dd>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;