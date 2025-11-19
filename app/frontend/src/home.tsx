'use client';

import React, { useEffect } from 'react';
import feather from 'feather-icons';
import { CurrencyDollarIcon } from "@heroicons/react/24/solid";

export default function app() {
  useEffect(() => {
    feather.replace();
  }, []);

  return (
    <div className="font-poppins">
      {/* Navigation */}
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="shrink-0 flex items-center">
                <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                <span className="text-xl font-bold">ClassQuest</span>
              </div>
            </div>
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <a href="/pages/auth/login" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Login
              </a>
              <a href="/pages/auth/signup" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Register
              </a>
            </div>
            <div className="-mr-2 flex items-center md:hidden">
              <button className="inline-flex items-center justify-center p-2 rounded-md text-blue-100 hover:text-white hover:bg-blue-600">
                <i data-feather="menu"></i>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative bg-gradient-to-r from-gray-700 to-gray-800 overflow-hidden">
        <div className="max-w-8xl mx-auto">
          <div className="relative z-10 pb-8 bg-gradient-to-r from-gray-710 to-gray-750 sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
            <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
              <div className="sm:text-center lg:text-left">
                <h1 className="text-4xl tracking-tight font-extrabold text-white sm:text-5xl md:text-6xl">
                  <span className="block">Transform Learning</span>
                  <span className="block text-white">Into An Adventure</span>
                </h1>
                <p className="mt-3 text-base text-white sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                  ClassQuest turns education into an exciting RPG experience where students complete quests, earn rewards, and level up their knowledge.
                </p>
                <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                  <div className="rounded-md shadow">
                    <a href="#" className="text-white w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 md:py-4 md:text-lg md:px-10">
                      Get Started
                    </a>
                  </div>
                  <div className="mt-3 sm:mt-0 sm:ml-3">
                    <a href="#" className="w-full flex items-center justify-center px-8 py-3 border  text-base font-medium rounded-md text-blue-700 bg-blue-100 bg-opacity-60 hover:bg-blue-300 md:py-4 md:text-lg md:px-10">
                      Learn more
                    </a>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
        <div className="lg:absolute lg:inset-y-0 lg:right-0 lg:w-1/2">
          <img
            className="h-56 w-full object-cover sm:h-72 md:h-96 lg:w-full lg:h-full"
            src="https://cdn.pixabay.com/photo/2016/06/01/06/26/open-book-1428428_960_720.jpg"
            alt="Students learning"
          />
        </div>
      </div>

      {/* Features Section */}
      <div className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Game Mechanics Meet Education
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-500 lg:mx-auto">
              The perfect blend of gamification and learning outcomes
            </p>
          </div>

         <div className="mt-10">
            <div className="space-y-10 md:space-y-0 md:grid md:grid-cols-2 md:gap-x-8 md:gap-y-10">
              {[
                { icon: 'award', title: 'XP & Leveling System', desc: 'Students earn experience points and level up as they complete assignments and demonstrate mastery.', color: 'bg-green-500' },
                { icon: 'shopping-bag', title: 'Rewards and Shop', desc: 'Earn gold coins for completing quests and spend them on avatar customization and power-ups.', color: 'bg-yellow-500' },
                { icon: 'map', title: 'Subject Maps', desc: 'Each subject has its own interactive map that represents subject learning objectives.', color: 'bg-indigo-500' },
                { icon: 'user', title: 'Avatar Customization', desc: 'Students can personalize their avatars with items purchased using their earned gold.', color: 'bg-pink-500' }
              ].map((feature, idx) => (
                <div key={idx} className="relative">
                  <div className={`absolute flex items-center justify-center h-12 w-12 rounded-md ${feature.color} text-white`}>
                    <i data-feather={feature.icon}></i>
                  </div>
                  <p className="ml-16 text-lg leading-6 font-medium text-gray-900">{feature.title}</p>
                  <p className="mt-2 ml-16 text-base text-gray-500">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Teacher Preview */}
      <div className="bg-white pt-16 sm:pt-24 lg:pt-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase">For Educators</h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
            Powerful Classroom Management
          </p>
        </div>
        <div className="mt-16 pb-12 bg-white">
          <div className="relative">
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <div className="rounded-lg shadow-xl overflow-hidden">
                  <div className="bg-white px-6 py-8 md:p-10">
                    <div className="flex items-center">
                      <div className="shrink-0 bg-indigo-700 rounded-md p-3">
                        <i data-feather="users" className="h-6 w-6 text-white"></i>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">Teacher Dashboard</h3>
                        <p className="mt-1 text-sm text-gray-500">Monitor student progress at a glance</p>
                      </div>
                    </div>
                    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                          {[
                            { icon: 'trending-up', label: 'Average XP', value: '1,243', color: 'bg-blue-500' },
                            { icon: 'check-circle', label: 'Completion Rate', value: '78%', color: 'bg-green-500' },
                            { icon: 'star', label: 'Top Student', value: 'Emma S.', color: 'bg-amber-500' }
                          ].map((stat, idx) => (
                            <div key={idx} className="bg-white overflow-hidden shadow rounded-lg">
                              <div className="px-4 py-5 sm:p-6">
                                <div className="flex items-center">
                                  <div className={`shrink-0 ${stat.color} rounded-md p-2`}>
                                    <i data-feather={stat.icon} className="h-5 w-5 text-white"></i>
                                  </div>
                                  <div className="ml-5 w-0 flex-1">
                                    <dt className="text-sm font-medium text-gray-500 truncate">{stat.label}</dt>
                                    <dd className="text-2xl font-semibold text-gray-900">{stat.value}</dd>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Student Preview */}
      <div className="bg-white py-16 sm:py-24 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase">For Students</h2>
              <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
                Your Learning Adventure
              </p>
              <p className="mt-3 text-lg text-gray-500 sm:mt-5">
                Complete quests, earn rewards, and watch your avatar grow as you master new concepts across all your subjects.
              </p>
              <div className="mt-8 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg shadow">
                    <i data-feather="chevrons-up" className="h-6 w-6 text-blue-500"></i>
                    <h3 className="mt-2 font-medium text-gray-900">Level Up</h3>
                    <p className="mt-1 text-sm text-gray-500">Gain XP and unlock new content</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg shadow">
                    <CurrencyDollarIcon className="h-6 w-6 text-yellow-500" />
                    <h3 className="mt-2 font-medium text-gray-900">Earn Gold</h3>
                    <p className="mt-1 text-sm text-gray-500">Get rewarded for your efforts</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
              <div className="relative mx-auto w-full rounded-lg shadow-lg lg:max-w-md">
                <div className="bg-white p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="relative">
                        <img className="h-16 w-16 rounded-full" src="http://static.photos/people/200x200/3" alt="Student avatar" />
                        <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full h-6 w-6 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">5</span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <h3 className="text-lg font-medium text-gray-900">Alex Johnson</h3>
                        <div className="flex items-center mt-1">
                          <div className="h-2 w-24 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: '65%' }}></div>
                          </div>
                          <span className="ml-2 text-sm text-gray-500">65% to Lvl 6</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center bg-yellow-100 px-3 py-1 rounded-full">
                      <CurrencyDollarIcon className="h-6 w-6 text-yellow-500" />
                      <span className="ml-1 font-light"> 1,245</span>
                    </div>
                  </div>
                  <div className="mt-6">
                    <h4 className="text-md font-medium text-gray-900">Current Quests</h4>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-4 rounded-lg border-2 border-blue-400 shadow-lg">
                        <h3 className="font-bold text-white">Algebraic Equations</h3>
                        <p className="text-white text-sm mb-3">Complete 10 equations to boost Intelligence</p>
                        <div className="flex items-center mb-2">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                          </div>
                          <span className="ml-2 text-xs text-white">6/10</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-royalpurple-50 text-sm">+15 Intelligence</span>
                          <button className="bg-blue-500 hover:bg-blue-600 text-black px-3 py-1 rounded-full text-xs font-bold">
                            Continue
                          </button>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-4 rounded-lg border-2 border-blue-400 shadow-lg">
                        <h3 className="font-bold text-white">Social Studies</h3>
                        <p className="text-white text-sm mb-3">Read 3 topics to boost Wisdom</p>
                        <div className="flex items-center mb-2">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '80%' }}></div>
                          </div>
                          <span className="ml-2 text-xs text-white">2/3</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-royalpurple-50 text-sm">+10 Wisdom</span>
                          <button className="bg-blue-500 hover:bg-blue-600 text-black px-3 py-1 rounded-full text-xs font-bold">
                            Continue
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

     {/* CTA Section */}
<div className="relative bg-gradient-to-r from-gray-600 via-gray-700 to-purple-900 text-white overflow-hidden">
  <div className="relative z-10 max-w-2xl mx-auto text-center py-16 px-4 sm:py-20 sm:px-6 lg:px-8">
    <h2 className="text-3xl font-extrabold sm:text-4xl">
      <span className="block">Ready to transform your classroom?</span>
      <span className="block text-blue-200">Start your ClassQuest journey today.</span>
    </h2>
    <p className="mt-4 text-lg leading-6 text-white">
      Whether you're a teacher looking to engage your students or a student ready for adventure, we've got you covered.
    </p>
    <a
      href="#"
      className="mt-8 inline-flex items-center justify-center px-6 py-3 text-base font-medium rounded-md bg-green-500 text-white shadow-lg hover:bg-green-600 transition duration-300"
    >
      Sign up for free
    </a>
  </div>
</div>


      {/* Footer */}
      <footer className="relative bg-gradient-to-r from-gray-600 via-gray-700 to-purple-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {[
              { title: 'Product', links: ['Features'] },
              { title: 'Resources', links: ['Documentation', 'Support'] },
              { title: 'Company', links: ['About'] },
              { title: 'Legal', links: ['Privacy', 'Terms'] }
            ].map((section, idx) => (
              <div key={idx}>
                <h3 className="text-sm font-semibold text-white tracking-wider uppercase">{section.title}</h3>
                <div className="mt-4 flex flex-col gap-4">
                  {section.links.map((link, linkIdx) => (
                    <a key={linkIdx} href="#" className="text-base text-gray-300 hover:text-white">
                      {link}
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 border-t border-gray-800 pt-8 md:flex md:items-center md:justify-between">
            <div className="flex space-x-6 md:order-2">
              {['github'].map((icon) => (
                <a key={icon} href="https://github.com/ClassQuest-Capstone/ClassQuest" className="text-gray-200 hover:text-white">
                  <i data-feather={icon} className="h-6 w-6"></i>
                </a>
              ))}
            </div>
            <p className="mt-8 text-base text-white md:mt-0 md:order-1">
              &copy; 2025 ClassQuest. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}