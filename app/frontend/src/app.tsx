import React from "react";

export default function app() {
  return (
    <div className="font-[Poppins] bg-slate-900 min-h-screen text-white">
      {/* Navigation */}
      <nav className="bg-blue-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center">
              <span className="text-xl font-bold flex items-center">
                ClassQuest
              </span>
            </div>
            <div className="hidden md:flex space-x-4">
              <a href="/login" className="px-3 py-2 rounded-md hover:bg-blue-600">Login</a>
              <a href="/register" className="px-3 py-2 rounded-md hover:bg-blue-600">Register</a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-blue-600 overflow-hidden">
        <div className="max-w-7xl mx-auto lg:flex">
          <div className="lg:w-1/2 px-8 py-20">
            <h1 className="text-5xl font-extrabold text-white leading-tight">
              Transform Learning <br />
              <span className="text-blue-300">Into An Adventure</span>
            </h1>
            <p className="mt-6 text-blue-100 max-w-xl">
              ClassQuest turns education into an exciting RPG experience where students complete quests, earn rewards, and level up their knowledge.
            </p>
            <div className="mt-8 flex space-x-4">
              <button className="bg-white text-blue-700 font-medium px-8 py-3 rounded-md shadow hover:bg-gray-50">
                Get Started
              </button>
              <button className="border border-white text-white px-8 py-3 rounded-md bg-blue-500 bg-opacity-60 hover:bg-opacity-70">
                Learn More
              </button>
            </div>
          </div>

          <div className="lg:w-1/2">
            <img
              className="w-full h-full object-cover"
              src="https://cdn.pixabay.com/photo/2016/06/01/06/26/open-book-1428428_960_720.jpg"
              alt="Students learning"
            />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white text-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-center text-4xl font-extrabold">Game Mechanics Meet Education</h2>
          <p className="text-center text-gray-500 mt-4 max-w-2xl mx-auto">
            The perfect blend of gamification and learning outcomes.
          </p>

          <div className="grid md:grid-cols-2 gap-10 mt-12">
            {["XP & Leveling System","Virtual Economy","Subject Maps","Avatar Customization"].map((title, i) => (
              <div key={i} className="flex items-start space-x-4">
                <div className="bg-blue-500 text-white p-3 rounded-md">★</div>
                <div>
                  <h3 className="font-semibold text-lg">{title}</h3>
                  <p className="text-gray-600 mt-1">
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-700 text-center py-20 px-6">
        <h2 className="text-4xl font-extrabold text-white">
          Ready to transform your classroom?
        </h2>
        <p className="mt-4 text-blue-200 text-lg max-w-2xl mx-auto">
          Whether you're a teacher looking to engage your students or a student ready for adventure, we've got you covered.
        </p>
        <button className="bg-white text-blue-700 font-medium px-10 py-3 rounded-md mt-8 shadow hover:bg-gray-100">
          Sign up for free
        </button>
      </section>

      {/* Footer */}
      <footer className="bg-gray-800 py-12 px-6 text-gray-400">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          {[
            { title: "Product", links: ["Features", "Pricing", "Teachers", "Students"] },
            { title: "Resources", links: ["Documentation", "Guides", "Blog", "Support"] },
            { title: "Company", links: ["About", "Careers", "Contact", "Press"] },
            { title: "Legal", links: ["Privacy", "Terms", "Cookie Policy"] },
          ].map((col, i) => (
            <div key={i}>
              <h3 className="uppercase text-sm font-semibold text-gray-400">{col.title}</h3>
              <ul className="mt-4 space-y-2">
                {col.links.map((link, j) => (
                  <li key={j} className="hover:text-white cursor-pointer">{link}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 text-center border-t border-gray-700 pt-8 text-gray-500">
          © 2023 ClassQuest. All rights reserved.
        </div>
      </footer>
    </div>
  );
}