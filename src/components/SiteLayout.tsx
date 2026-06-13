import { Link, useLocation } from 'react-router-dom'
import { useState } from 'react'

const navLinks = [
  { to: '/features', label: 'Funzionalita' },
  { to: '/pricing', label: 'Prezzi' },
  { to: '/api', label: 'API' },
  { to: '/security', label: 'Security' },
]

const footerLinks = [
  { to: '/terms', label: 'Termini di Servizio' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/security', label: 'Security & Compliance' },
  { to: '/api', label: 'API' },
]

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-md z-50">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 max-w-6xl mx-auto">
          <Link to="/" className="flex items-center shrink-0">
            <img src="/dr7trust-logo.png" alt="DR7 Trust" className="h-10 sm:h-14 w-auto" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`text-[14px] px-3 py-2 rounded-lg transition-colors ${
                  location.pathname === link.to
                    ? 'text-green-700 font-semibold bg-green-50'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link to="/login" className="text-sm text-gray-500 hover:text-gray-800 transition-colors px-3 sm:px-4 py-2 whitespace-nowrap hidden sm:block">
              Log in
            </Link>
            <Link to="/login" className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold px-4 sm:px-6 py-2.5 rounded-lg transition-colors shadow-md shadow-green-600/20 whitespace-nowrap">
              Inizia Gratis
            </Link>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-2 text-gray-500 hover:text-gray-800 transition-colors"
              aria-label="Menu"
            >
              {mobileOpen ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-gray-100 bg-white px-4 pb-4">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block text-[15px] px-3 py-3 rounded-lg transition-colors ${
                  location.pathname === link.to
                    ? 'text-green-700 font-semibold bg-green-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="block text-[15px] px-3 py-3 text-gray-600 hover:bg-gray-50 rounded-lg sm:hidden"
            >
              Log in
            </Link>
          </div>
        )}
      </header>

      {/* Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-12">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 sm:gap-8">
            <div>
              <img src="/dr7trust-logo.png" alt="DR7 Trust" className="h-10 w-auto mb-3" />
              <p className="text-sm text-gray-400 max-w-xs">Infrastructure for Digital Trust</p>
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              {footerLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-sm text-gray-400 hover:text-green-600 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-gray-200 text-xs text-gray-300 text-center sm:text-left">
            DR7 Trust - Infrastructure for Digital Trust
          </div>
        </div>
      </footer>
    </div>
  )
}
