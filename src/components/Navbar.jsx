import { Link, useLocation } from 'react-router-dom'
import { Users, DollarSign, Crown } from 'lucide-react'

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200 h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center gap-6">
        <Link
          to="/"
          className="flex items-center gap-2.5 text-indigo-600 hover:text-indigo-700 transition-colors shrink-0"
        >
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Users className="w-4.5 h-4.5 text-white" size={18} />
          </div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">
            Client<span className="text-indigo-600">Hub</span>
          </span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to="/"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              pathname === '/' || pathname.startsWith('/clients')
                ? 'text-indigo-600 bg-indigo-50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Users size={14} /> Clients
          </Link>
          <Link
            to="/commission"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              pathname.startsWith('/commission')
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <DollarSign size={14} /> Commission
          </Link>
          <Link
            to="/admin"
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
              pathname.startsWith('/admin')
                ? 'text-violet-600 bg-violet-50'
                : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
            }`}
          >
            <Crown size={14} /> Admin
          </Link>
        </div>
      </div>
    </nav>
  )
}
