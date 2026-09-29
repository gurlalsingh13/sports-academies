import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';

export function getDeadlineUrgency(endDateStr) {
  if (!endDateStr) return { label: 'No Deadline', sublabel: 'Open-ended', badgeClass: 'bg-slate-100 text-slate-500 border-slate-200', icon: '—', days: 999 };
  
  const end = new Date(endDateStr);
  const now = new Date();
  
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endDate = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  
  const diffTime = endDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const formattedDate = end.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' });
  
  if (diffDays < 0) {
    return {
      label: 'Expired',
      sublabel: formattedDate,
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-150',
      icon: '❌',
      days: diffDays
    };
  } else if (diffDays <= 5) {
    return {
      label: 'Very urgent',
      sublabel: `${formattedDate} (${diffDays}d left)`,
      badgeClass: 'bg-red-55 bg-red-50 text-red-700 border-red-150 animate-pulse',
      icon: '⚠️',
      days: diffDays
    };
  } else if (diffDays <= 30) {
    return {
      label: 'Closing soon',
      sublabel: `${formattedDate} (${diffDays}d left)`,
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-150',
      icon: '⏳',
      days: diffDays
    };
  } else {
    return {
      label: 'Safe',
      sublabel: `${formattedDate} (${diffDays}d left)`,
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-150',
      icon: '✅',
      days: diffDays
    };
  }
}

export function getValidationBadge(status) {
  switch (status?.toUpperCase()) {
    case 'VERIFIED':
      return { label: 'VERIFIED', badgeClass: 'bg-teal-50 text-teal-800 border-teal-200', icon: CheckCircle2 };
    case 'HIGH_CONFIDENCE':
      return { label: 'HIGH CONFIDENCE', badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200', icon: CheckCircle2 };
    case 'LIKELY_VALID':
      return { label: 'LIKELY VALID', badgeClass: 'bg-amber-50 text-amber-800 border-amber-200', icon: HelpCircle };
    case 'NEEDS_REVIEW':
      return { label: 'NEEDS REVIEW', badgeClass: 'bg-orange-50 text-orange-850 border-orange-200', icon: AlertCircle };
    case 'LOW_CONFIDENCE':
      return { label: 'LOW CONFIDENCE', badgeClass: 'bg-rose-50 text-rose-800 border-rose-200', icon: AlertCircle };
    default:
      return { label: 'UNVERIFIED', badgeClass: 'bg-slate-50 text-slate-650 border-slate-200', icon: HelpCircle };
  }
}

export default function ScholarshipTable({ scholarships, isLoading }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [validationFilter, setValidationFilter] = useState('ALL');
  const [deadlineFilter, setDeadlineFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('title');
  const [sortOrder, setSortOrder] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Formatting helpers
  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Never';
    const date = new Date(isoString);
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'Just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' });
  };

  // Filtering & Sorting Logic
  const processedData = useMemo(() => {
    let result = [...scholarships];

    // Search by title, organization or location
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.title?.toLowerCase().includes(lower) ||
          s.organization?.toLowerCase().includes(lower) ||
          s.domicile?.toLowerCase().includes(lower) ||
          s.source_url?.toLowerCase().includes(lower)
      );
    }

    // Location Filter
    if (locationFilter.trim()) {
      const locLower = locationFilter.trim().toLowerCase();
      result = result.filter((s) => {
        const text = `${s.title} ${s.domicile} ${s.organization} ${s.source_url}`.toLowerCase();
        return text.includes(locLower);
      });
    }

    // Sport / Scheme Type Filter
    if (typeFilter !== 'ALL') {
      result = result.filter((s) => s.scheme_type === typeFilter);
    }

    // Status Filter
    if (statusFilter !== 'ALL') {
      result = result.filter((s) => {
        const sStatus = s.computed_status || (s.is_active ? 'ACTIVE' : 'NO_LONGER_VERIFIABLE');
        return sStatus === statusFilter;
      });
    }

    // Validation Filter
    if (validationFilter !== 'ALL') {
      result = result.filter((s) => {
        const valStatus = s.scholarship_validations?.[0]?.status || 'UNVERIFIED';
        return valStatus === validationFilter;
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      if (sortBy === 'deadline') {
        aVal = a.application_end ? new Date(a.application_end) : new Date('2099-12-31');
        bVal = b.application_end ? new Date(b.application_end) : new Date('2099-12-31');
      } else if (sortBy === 'score' || sortBy === 'confidence') {
        const valA = Array.isArray(a.scholarship_validations) ? a.scholarship_validations[0] : a.scholarship_validations;
        const valB = Array.isArray(b.scholarship_validations) ? b.scholarship_validations[0] : b.scholarship_validations;
        aVal = valA?.legitimacy_score ?? (valA?.confidence ? valA.confidence * 100 : 0);
        bVal = valB?.legitimacy_score ?? (valB?.confidence ? valB.confidence * 100 : 0);
      }

      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;

      if (typeof aVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      } else {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }
    });

    return result;
  }, [scholarships, searchTerm, locationFilter, statusFilter, typeFilter, validationFilter, deadlineFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return processedData.slice(start, start + itemsPerPage);
  }, [processedData, currentPage]);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      {/* Controls Bar */}
      <div className="p-5 border-b border-slate-200 flex flex-wrap items-center gap-4 bg-slate-50">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search sports academy name or keywords..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 border border-slate-250 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all font-sans"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Location Search Input */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-250 px-3 py-1.5 rounded-lg">
            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Location:</span>
            <input
              type="text"
              placeholder="e.g. Delhi"
              value={locationFilter}
              onChange={(e) => { setLocationFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none outline-none focus:ring-0 w-28 placeholder-slate-400"
            />
          </div>

          {/* Sport / Discipline Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Sport:</span>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
            >
              <option value="ALL">All Sports</option>
              <option value="CRICKET">Cricket</option>
              <option value="BADMINTON">Badminton</option>
              <option value="FOOTBALL">Football</option>
              <option value="TENNIS">Tennis</option>
              <option value="SWIMMING">Swimming</option>
              <option value="BASKETBALL">Basketball</option>
              <option value="MARTIAL_ARTS">Martial Arts / Boxing</option>
              <option value="ATHLETICS">Athletics</option>
              <option value="MULTI_SPORT">Multi-Sport</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="EXPIRING_SOON">Expiring Soon</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* Validation Filter */}
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-lg">
            <span className="text-xs text-slate-450 font-semibold uppercase tracking-wider">Valid:</span>
            <select
              value={validationFilter}
              onChange={(e) => { setValidationFilter(e.target.value); setCurrentPage(1); }}
              className="text-xs font-semibold text-slate-700 bg-transparent border-none outline-none focus:ring-0 cursor-pointer"
            >
              <option value="ALL">All Validation</option>
              <option value="VERIFIED">Verified</option>
              <option value="HIGH_CONFIDENCE">High Confidence</option>
              <option value="LIKELY_VALID">Likely Valid</option>
              <option value="NEEDS_REVIEW">Needs Review</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/50 border-b border-slate-200 text-xs text-slate-500 font-semibold uppercase tracking-wider select-none">
              <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('title')}>
                <div className="flex items-center gap-1.5">
                  <span>Academy Name</span>
                  <ArrowUpDown size={13} className="text-slate-400" />
                </div>
              </th>
              <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('organization')}>
                <div className="flex items-center gap-1.5">
                  <span>Managing Authority</span>
                  <ArrowUpDown size={13} className="text-slate-400" />
                </div>
              </th>
              <th className="px-6 py-4">Sport Category</th>
              <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('domicile')}>
                <div className="flex items-center gap-1.5">
                  <span>Location</span>
                  <ArrowUpDown size={13} className="text-slate-400" />
                </div>
              </th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 cursor-pointer hover:bg-slate-100 transition-colors" onClick={() => handleSort('confidence')}>
                <div className="flex items-center gap-1.5">
                  <span>Confidence Score</span>
                  <ArrowUpDown size={13} className="text-slate-400" />
                </div>
              </th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-150 text-sm">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="px-6 py-4" colSpan="7">
                    <div className="h-4 bg-slate-200 rounded w-full"></div>
                  </td>
                </tr>
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <AlertCircle size={28} className="text-slate-350" />
                    <span className="font-semibold text-slate-800 text-base">No sports academies found</span>
                    <span className="text-slate-500 text-xs">Try resetting filters or typing a different search query.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedData.map((s) => {
                const valObj = Array.isArray(s.scholarship_validations) ? s.scholarship_validations[0] : s.scholarship_validations;
                const score = valObj?.legitimacy_score ?? (valObj?.confidence ? Math.round(valObj.confidence * 100) : 0);
                const confidencePct = valObj?.confidence ? Math.round(valObj.confidence * 100) : score;
                const valInfo = getValidationBadge(valObj?.status);
                const ValIcon = valInfo.icon;
                const hasChanges = s.scholarship_changes && s.scholarship_changes.length > 0;

                return (
                  <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900 max-w-[280px]">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span className="truncate block" title={s.title}>{s.title}</span>
                          {hasChanges && (
                            <button
                              onClick={() => navigate(`/scholarships/${s.id}?tab=changes`)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-purple-50 text-purple-750 border border-purple-200 rounded-full hover:bg-purple-100 transition-colors select-none"
                            >
                              ✦ CHANGED
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600 truncate max-w-[160px]" title={s.organization}>
                      {s.organization || '—'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono uppercase bg-slate-100 text-slate-650 px-2 py-1 rounded">
                        {s.scheme_type?.replace('_', ' ') || 'MULTI_SPORT'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-indigo-50/60 text-indigo-700 border border-indigo-150">
                        📍 {s.domicile || 'Delhi / NCR'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const sStatus = s.computed_status || (s.is_active ? 'ACTIVE' : 'NO_LONGER_VERIFIABLE');
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                            sStatus === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            sStatus === 'EXPIRING_SOON' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                            sStatus === 'EXPIRED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-slate-50 text-slate-700 border-slate-250'
                          }`}>
                            {sStatus?.replace('_', ' ')}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-extrabold rounded-md border ${
                            confidencePct >= 80 ? 'bg-emerald-50 text-emerald-800 border-emerald-300' :
                            confidencePct >= 50 ? 'bg-amber-50 text-amber-800 border-amber-300' :
                            'bg-rose-50 text-rose-800 border-rose-300'
                          }`}>
                            <span className="font-mono">{confidencePct}%</span>
                            <span className="text-[10px] uppercase font-bold text-slate-500">Confidence</span>
                          </span>
                          <span className="text-xs font-semibold text-slate-400">({score}/100)</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-28 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-1.5 rounded-full ${
                              confidencePct >= 80 ? 'bg-emerald-500' :
                              confidencePct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                            }`}
                            style={{ width: `${Math.min(confidencePct, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => navigate(`/scholarships/${s.id}`)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-900 border border-indigo-200 hover:border-indigo-400 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 transition-all shadow-sm"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!isLoading && totalPages > 1 && (
        <div className="p-5 border-t border-slate-200 flex items-center justify-between bg-slate-50 select-none">
          <span className="text-xs font-semibold text-slate-500">
            Showing {(currentPage - 1) * itemsPerPage + 1}–{Math.min(currentPage * itemsPerPage, processedData.length)} of {processedData.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((c) => Math.max(c - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-slate-250 rounded-lg hover:bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }).map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentPage(idx + 1)}
                className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${
                  currentPage === idx + 1
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'border-slate-250 hover:bg-white text-slate-700'
                }`}
              >
                {idx + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage((c) => Math.min(c + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-slate-250 rounded-lg hover:bg-white text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
