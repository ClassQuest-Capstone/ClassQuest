import React, { useEffect } from 'react';
import feather from 'feather-icons';
import { CurrencyDollarIcon } from "@heroicons/react/24/solid";
import { Link } from 'react-router-dom';
import { CharacterGrid } from './pages/components/cards/characterGrid.js';
import { CardStack } from './pages/components/cards/cardStack.js'

/** Todo: Fix nest mess */

export default function Home() {
  useEffect(() => {
    feather.replace();
  }, []);

  return (
    <div className="font-poppins w-full overflow-x-hidden">
      {/* Navigation Menu */}
      <nav className="bg-blue-700 text-white shadow-lg relative z-50 w-full">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="shrink-0 flex items-center">
                {/* Logo */}
                <Link to="/" className="flex items-center px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                <i data-feather="book-open" className="w-8 h-8 mr-2"></i>
                <span className="text-xl font-bold"> ClassQuest</span>
                </Link>
              </div>
            </div>
            {/** Navigation links */}
            <div className="hidden md:ml-6 md:flex md:items-center md:space-x-4">
              <Link to="/role" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Login
              </Link>
              <Link to="/Signup" className="px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-600">
                Register
              </Link>
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
        <div className="relative w-full min-h-screen overflow-hidden">
          {/* Background GIF */}
       <div className="absolute inset-0 -z-10">
            <img
              src="/assets/GifBckgnd.gif"
              alt="Animated background"
              className="w-full h-full object-cover"
            />
            {/* Dark overlay for readability */}
            <div className="absolute inset-0 bg-black/40"></div>
          </div>
          {/** Hero content */}
          <div className="max-w-8xl mx-auto flex items-center justify-center min-h-[70vh]">
            <div className="relative z-10 pb-8 sm:pb-16 md:pb-20 lg:pb-28 xl:pb-32 text-center">
              <main className="mt-10 mx-auto max-w-3xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 xl:mt-28 bg-gradient-to-b from-gray-900/90 to-transparent rounded-lg">
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl tracking-tight font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-[#ff00d4] to-amber-500 mt-3 p-0.5">
                  <span className="block ">Transform Learning</span>   
                  <span className="block ">Into An Adventure</span> 
                </h1>
                
                <p className="mt-3 text-base sm:text-lg md:text-lg text-white sm:mt-5 md:mt-5 max-w-xl mx-auto">
                  ClassQuest turns education into an exciting RPG experience where students complete quests,
                  earn rewards, and level up their knowledge.
                </p>

                <div className="mt-5 sm:mt-8 flex justify-center">
                  <div className="rounded-md shadow">
                    <a href="/Signup" 
                    className="text-white w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700  md:py-4 md:text-lg md:px-10 mb-3.5" >
                      Get Started
                    </a>
                  </div>
                </div>
              </main>
            </div>
          </div>
          {/** Fade out to background */}
          <div className="pointer-events-none absolute bottom-0 left-0 w-full h-32 bg-gradient-to-b from-transparent to-gray-900"></div>
        </div>

        {/** Character overview section */}
        <div className="bg-gray-900">
          {/** Section Header */}
        <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8 lg:text-center">
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-[#b59c81] sm:text-4xl">
              Choose your Hero
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-300 lg:mx-auto">
              Select and customize your avatar to represent you on your learning journey. 
            </p>
          </div>
          {/** Character cards */}
          <CharacterGrid />
        </div>

      {/* Features Section */}
    <div className="bg-gray-900">
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 lg:text-center">
    {/* Section Header */}
            <p className="mt-0.5 text-3xl leading-8 font-extrabold tracking-tight text-[#b59c81] sm:text-4xl">
              Level up your Learning
            </p>
            <p className="mt-4 max-w-2xl text-xl text-gray-300 lg:mx-auto">
              The perfect blend of gamification and learning outcomes
            </p>
          </div>
        {/* Features cards */}
         <CardStack />
        </div>

      {/* Teacher Preview */}
      <div className="bg-gray-900 pt-16 sm:pt-24 lg:pt-32 mt-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 text-center">
          {/** Section Header */}
          <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase mt-9">For Educators</h2>
          <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-[#b59c81] sm:text-4xl">
            Powerful Classroom Management
          </p>
        </div>
        <div className="mt-16 pb-12 sm:pb-16 lg:pb-20">
          <div className="relative">
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="max-w-4xl mx-auto">
                <div className="rounded-lg shadow-xl overflow-hidden">
                  {/** Teacher Dashboard preview */}
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
                    {/** Stats tiles*/}
                    <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-3">
                          {[
                            { icon: 'trending-up', label: 'Average XP', value: '1,243', color: 'bg-blue-500' },
                            { icon: 'check-circle', label: 'Completion Rate', value: '78%', color: 'bg-green-500' },
                            { icon: 'star', label: 'Top Student', value: 'Emma S.', color: 'bg-amber-500' }
                          ].map((stat, idx) => (
                            <div key={idx} className="bg-gradient-to-r from-yellow-300 to-gray-400 overflow-hidden shadow rounded-lg">
                              <div className="px-4 py-5 sm:p-6">
                                <div className="flex items-center">
                                  <div className={`shrink-0 ${stat.color} rounded-md p-2`}>
                                    <i data-feather={stat.icon} className="h-5 w-5 text-white"></i>
                                  </div>
                                  <div className="ml-5 w-0 flex-1">
                                    <dt className="text-sm font-medium text-gray-700 truncate">{stat.label}</dt>
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
      <div className="bg-gray-900 py-16 sm:py-24 lg:py-15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:grid lg:grid-cols-12 lg:gap-8">
            {/* Content */}
            <div className="sm:text-center md:max-w-2xl md:mx-auto lg:col-span-6 lg:text-left">
              {/** Section Header */}
              <h2 className="text-base text-blue-600 font-semibold tracking-wide uppercase">For Students</h2>
              <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-[#b59c81] sm:text-4xl">
                Make friends along the way
              </p>
              <p className="mt-3 text-lg text-gray-100 sm:mt-5">
                Join Guilds complete boss battles, earn rewards, with your friends by your side.
              </p>
              {/** Guild image */}
              <div className="mt-1 sm:max-w-lg sm:mx-auto sm:text-center lg:text-left lg:mx-11">
                <img className="h-80 w-90" src="/assets/Guild.png" alt="Student avatar" />
              </div>
            </div>
            {/* Guild card and quests preview */}
            <div className="mt-12 relative sm:max-w-lg sm:mx-auto lg:mt-0 lg:max-w-none lg:mx-0 lg:col-span-6 lg:flex lg:items-center">
              <div className="relative mx-auto w-full px-4 sm:px-0 rounded-lg shadow-lg lg:max-w-md">
                <div className="bg-white p-4 sm:p-6 rounded-lg shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="relative">
                        <img className="h-12 w-12 sm:h-16 sm:w-16 rounded-full" src="/assets/mage-head.png" alt="Student avatar" />
                        <div className="absolute bottom-0 right-0 bg-blue-500 rounded-full h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center">
                          <span className="text-xs font-bold text-white">5</span>
                        </div>
                      </div>
                      {/* Student Guild card preview */}
                      <div className="ml-3 sm:ml-4">
                        <h3 className="text-base sm:text-lg font-medium text-gray-900">Alex87665</h3>
                        <div className="flex items-center mt-1">
                          <div className="h-2 w-20 sm:w-24 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: '65%' }}></div>
                          </div>
                          <span className="ml-2 text-xs sm:text-sm text-gray-500">65% to Lvl 6</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center bg-yellow-100 px-2 sm:px-3 py-1 rounded-full">
                      <CurrencyDollarIcon className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-500" />
                      <span className="ml-1 font-light text-gray-900 text-sm">1,245</span>
                    </div>
                  </div>
                  <div className="mt-4 sm:mt-6">
                    <h4 className="text-sm sm:text-md font-medium text-gray-900">Guild Battles</h4>
                    <div className="grid grid-cols-1 gap-3 sm:gap-4">
                      <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-3 sm:p-4 rounded-lg border-2 border-blue-400 shadow-lg">
                        <h3 className="font-bold text-white text-sm sm:text-base">Algebraic Equations</h3>
                        <p className="text-white text-xs sm:text-sm mb-2 sm:mb-3">Complete 10 practice set to boost Intelligence</p>
                        <div className="flex items-center mb-2">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '60%' }}></div>
                          </div>
                          <span className="ml-2 text-xs text-white">6/10</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-royalpurple-50 text-xs sm:text-sm">+15 Intelligence</span>
                          <button className="bg-blue-500 hover:bg-blue-600 text-black px-2 sm:px-3 py-1 rounded-full text-xs font-bold">
                            Continue
                          </button>
                        </div>
                      </div>
                      <div className="bg-gradient-to-r from-purple-600 to-purple-800 p-3 sm:p-4 rounded-lg border-2 border-blue-400 shadow-lg">
                        <h3 className="font-bold text-white text-sm sm:text-base">Social Studies</h3>
                        <p className="text-white text-xs sm:text-sm mb-2 sm:mb-3">Read 3 topics to boost Wisdom</p>
                        <div className="flex items-center mb-2">
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <div className="bg-green-500 h-2 rounded-full" style={{ width: '80%' }}></div>
                          </div>
                          <span className="ml-2 text-xs text-white">2/3</span>
                        </div>
                        <div className="flex justify-between items-center gap-2">
                          <span className="text-royalpurple-50 text-xs sm:text-sm">+10 Wisdom</span>
                          <button className="bg-blue-500 hover:bg-blue-600 text-black px-2 sm:px-3 py-1 rounded-full text-xs font-bold">
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
      href="/Signup"
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
};