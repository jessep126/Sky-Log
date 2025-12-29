import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Plane, 
  Plus, 
  Calendar, 
  MapPin, 
  TrendingUp, 
  Trophy, 
  History,
  Sparkles,
  Trash2,
  ChevronRight,
  Globe,
  Zap,
  Loader2,
  X,
  Navigation,
  ArrowDownCircle,
  LayoutGrid,
  List
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
interface Flight {
  id: string;
  departure: string;
  arrival: string;
  date: string;
  airline?: string;
}

interface Stats {
  totalFlights: number;
  uniqueDestinations: number;
  topPlaces: { name: string; count: number }[];
}

interface YearlyRecap {
  year: string;
  totalFlights: number;
  uniqueDestinations: number;
  topDestination: string;
}

// --- App Component ---
const App = () => {
  const [flights, setFlights] = useState<Flight[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('All Time');
  const [viewMode, setViewMode] = useState<'timeline' | 'recaps'>('timeline');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'smart' | 'manual'>('smart');
  const [newFlight, setNewFlight] = useState({ departure: '', arrival: '', date: '', airline: '' });
  const [smartInput, setSmartInput] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeField, setActiveField] = useState<'departure' | 'arrival' | null>(null);
  
  const timelineRef = useRef<HTMLDivElement>(null);

  // Load data
  useEffect(() => {
    const saved = localStorage.getItem('skylog_flights');
    if (saved) {
      setFlights(JSON.parse(saved));
    }
  }, []);

  // Save data
  useEffect(() => {
    localStorage.setItem('skylog_flights', JSON.stringify(flights));
  }, [flights]);

  const yearStatsMap = useMemo(() => {
    const counts: Record<string, number> = { 'All Time': flights.length };
    flights.forEach(f => {
      const y = new Date(f.date).getFullYear().toString();
      counts[y] = (counts[y] || 0) + 1;
    });
    return counts;
  }, [flights]);

  const years = useMemo(() => {
    const yearsSet = new Set<string>(flights.map(f => new Date(f.date).getFullYear().toString()));
    return ['All Time', ...Array.from(yearsSet).sort((a: string, b: string) => b.localeCompare(a))];
  }, [flights]);

  // Generate summaries for all years
  const yearlyRecaps = useMemo((): YearlyRecap[] => {
    return years.filter(y => y !== 'All Time').map(y => {
      const yearFlights = flights.filter(f => new Date(f.date).getFullYear().toString() === y);
      const destinations = yearFlights.map(f => f.arrival.trim().toLowerCase());
      const counts: Record<string, number> = {};
      destinations.forEach(d => counts[d] = (counts[d] || 0) + 1);
      
      const topDest = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
      
      return {
        year: y,
        totalFlights: yearFlights.length,
        uniqueDestinations: new Set(destinations).size,
        topDestination: topDest.charAt(0).toUpperCase() + topDest.slice(1)
      };
    });
  }, [flights, years]);

  const frequentCities = useMemo(() => {
    const counts: Record<string, number> = {};
    flights.forEach(f => {
      counts[f.departure] = (counts[f.departure] || 0) + 1;
      counts[f.arrival] = (counts[f.arrival] || 0) + 1;
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [flights]);

  const filteredFlights = useMemo(() => {
    if (selectedYear === 'All Time') return [...flights].sort((a: Flight, b: Flight) => b.date.localeCompare(a.date));
    return flights
      .filter(f => new Date(f.date).getFullYear().toString() === selectedYear)
      .sort((a: Flight, b: Flight) => b.date.localeCompare(a.date));
  }, [flights, selectedYear]);

  const stats = useMemo((): Stats => {
    const data = filteredFlights;
    const destinations = data.map(f => f.arrival);
    const counts: Record<string, number> = {};
    destinations.forEach(d => {
      const clean = d.trim().toLowerCase();
      counts[clean] = (counts[clean] || 0) + 1;
    });

    const topPlaces = Object.entries(counts)
      .map(([name, count]) => ({ 
        name: name.charAt(0).toUpperCase() + name.slice(1), 
        count 
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalFlights: data.length,
      uniqueDestinations: new Set(destinations.map(d => d.toLowerCase().trim())).size,
      topPlaces
    };
  }, [filteredFlights]);

  const scrollToTimeline = () => {
    timelineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSmartParse = async () => {
    if (!smartInput.trim()) return;
    setIsParsing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Extract flight details from this text: "${smartInput}". 
        Today's date is ${new Date().toISOString().split('T')[0]}.
        Return a JSON object with keys: departure, arrival, date (YYYY-MM-DD), airline.
        If a detail is missing, return an empty string for that key.`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              departure: { type: Type.STRING },
              arrival: { type: Type.STRING },
              date: { type: Type.STRING },
              airline: { type: Type.STRING }
            }
          }
        }
      });

      const result = JSON.parse(response.text || '{}');
      setNewFlight({
        departure: result.departure || '',
        arrival: result.arrival || '',
        date: result.date || new Date().toISOString().split('T')[0],
        airline: result.airline || ''
      });
      setModalTab('manual');
    } catch (error) {
      console.error("Parsing error", error);
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddFlight = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFlight.departure || !newFlight.arrival || !newFlight.date) return;

    const flight: Flight = {
      ...newFlight,
      id: crypto.randomUUID(),
    };

    setFlights([...flights, flight]);
    setNewFlight({ departure: '', arrival: '', date: '', airline: '' });
    setSmartInput('');
    setIsModalOpen(false);
    
    // Jump to the year of the added flight if it's not currently selected
    const flightYear = new Date(flight.date).getFullYear().toString();
    if (selectedYear !== 'All Time' && selectedYear !== flightYear) {
      setSelectedYear(flightYear);
    }
    setViewMode('timeline');
    setTimeout(scrollToTimeline, 100);
  };

  const deleteFlight = (id: string) => {
    setFlights(flights.filter(f => f.id !== id));
  };

  const generateAiInsights = async () => {
    if (flights.length === 0) return;
    setIsAiLoading(true);
    setAiInsight(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const flightHistoryStr = flights.map(f => `${f.date}: ${f.departure} to ${f.arrival}`).join(', ');
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `I am a traveler. Here is my flight history: ${flightHistoryStr}. 
        Analyze my travel patterns. Tell me what kind of traveler I am (a persona), 
        give me a 2-sentence fun summary, and one recommendation for my next destination based on where I've been. 
        Format nicely but concisely.`,
      });

      setAiInsight(response.text || "Couldn't generate insights.");
    } catch (error) {
      console.error(error);
      setAiInsight("Failed to connect to the captain (AI). Please check your connection.");
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-20 bg-slate-50">
      {/* Header */}
      <header className="flight-gradient text-white pt-12 pb-24 px-6 relative overflow-hidden">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-500 rounded-lg shadow-inner">
                <Plane className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">SkyLog</h1>
            </div>
            <p className="text-blue-100 opacity-90 font-medium">Clear skies for your travels.</p>
          </div>
          <button 
            onClick={() => {
              setIsModalOpen(true);
              setModalTab('smart');
            }}
            className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-2xl hover:bg-blue-50 transition-all transform active:scale-95 border border-slate-200"
          >
            <Plus className="w-6 h-6" /> Log New Flight
          </button>
        </div>
        
        <div className="absolute top-0 right-0 w-96 h-96 opacity-10 pointer-events-none">
          <svg viewBox="0 0 100 100" className="w-full h-full text-white">
            <path d="M10,90 Q50,10 90,50" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="5,5" />
          </svg>
        </div>
      </header>

      <main className="max-w-5xl mx-auto -mt-12 px-6">
        {/* Dashboard Navigation */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
           {/* Year Selector */}
          <div className="flex items-center gap-3 overflow-x-auto w-full md:w-auto pb-2 no-scrollbar">
            {years.map(year => (
              <button
                key={year}
                onClick={() => {
                  setSelectedYear(year);
                  setViewMode('timeline');
                }}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl whitespace-nowrap font-bold transition-all shadow-sm border ${
                  selectedYear === year && viewMode === 'timeline'
                    ? 'bg-blue-600 text-white shadow-blue-200 border-blue-600' 
                    : 'bg-white text-slate-600 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <span>{year}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-black ${selectedYear === year && viewMode === 'timeline' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-400'}`}>
                  {yearStatsMap[year] || 0}
                </span>
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-full md:w-auto">
            <button 
              onClick={() => setViewMode('timeline')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'timeline' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <List className="w-4 h-4" /> Timeline
            </button>
            <button 
              onClick={() => setViewMode('recaps')}
              className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'recaps' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutGrid className="w-4 h-4" /> Yearly Recaps
            </button>
          </div>
        </div>

        {viewMode === 'timeline' ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* Summary Header for Year */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200 animate-in fade-in duration-500">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Navigation className="w-5 h-5 text-blue-500" />
                    {selectedYear === 'All Time' ? 'Lifetime Summary' : `${selectedYear} Overview`}
                  </h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <div className="flex flex-col">
                      <span className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Total Flights</span>
                      <span className="text-4xl font-black text-slate-900">{stats.totalFlights}</span>
                    </div>
                    <div className="flex flex-col border-slate-100 sm:border-l sm:pl-6">
                      <span className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Destinations</span>
                      <span className="text-4xl font-black text-slate-900">{stats.uniqueDestinations}</span>
                    </div>
                    <div className="flex flex-col border-slate-100 sm:border-l sm:pl-6">
                      <span className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Status</span>
                      <span className="text-xl font-bold text-emerald-600 mt-2">Active Sky</span>
                    </div>
                </div>
              </div>

              {/* AI Insights Card */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-400/20 rounded-xl">
                          <Sparkles className="w-6 h-6 text-amber-400" />
                        </div>
                        <h3 className="font-bold text-xl">AI Traveler Profile</h3>
                      </div>
                      <button 
                        onClick={generateAiInsights}
                        disabled={isAiLoading || flights.length === 0}
                        className="text-sm font-bold bg-white/10 hover:bg-white/20 px-4 py-2 rounded-xl backdrop-blur-sm transition-all border border-white/10"
                      >
                        {isAiLoading ? "Analyzing..." : "Refresh Insights"}
                      </button>
                  </div>
                  {aiInsight ? (
                    <div className="space-y-4 text-slate-200 leading-relaxed text-lg">
                      {aiInsight.split('\n').map((line, i) => <p key={i}>{line}</p>)}
                    </div>
                  ) : (
                    <p className="text-slate-400 italic">
                      {flights.length === 0 
                        ? "Add some flights to unlock your AI traveler profile!" 
                        : "Log more flights to help Gemini define your traveler DNA."}
                    </p>
                  )}
                </div>
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20"></div>
              </div>

              {/* Timeline View */}
              <div ref={timelineRef} className="space-y-6 scroll-mt-8">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <History className="w-5 h-5" />
                    {selectedYear} Flight Log
                  </h3>
                  <span className="text-sm text-slate-400 font-bold uppercase tracking-widest">{filteredFlights.length} Entries</span>
                </div>
                {filteredFlights.length === 0 ? (
                  <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-16 text-center animate-in fade-in zoom-in duration-500">
                    <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Plane className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-500 font-medium">No flights logged for {selectedYear}.</p>
                    <button 
                      onClick={() => { setIsModalOpen(true); setModalTab('manual'); }}
                      className="mt-4 text-blue-600 font-bold hover:underline"
                    >
                      Record a flight now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredFlights.map((flight) => (
                      <div 
                        key={flight.id} 
                        className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 flex items-center gap-6 group hover:border-blue-200 transition-all animate-in fade-in slide-in-from-bottom duration-500"
                      >
                        <div className="bg-slate-50 p-4 rounded-2xl group-hover:bg-blue-50 transition-colors">
                          <Plane className="w-6 h-6 text-slate-400 group-hover:text-blue-500 transition-colors" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-lg font-bold text-slate-900">{flight.departure}</span>
                            <div className="flex-1 border-t-2 border-dashed border-slate-100 max-w-[40px]"></div>
                            <span className="text-lg font-bold text-slate-900">{flight.arrival}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm">
                            <span className="flex items-center gap-1.5 font-semibold text-slate-500">
                              <Calendar className="w-4 h-4" /> {new Date(flight.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                            {flight.airline && (
                              <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-xs font-bold uppercase tracking-wider">
                                {flight.airline}
                              </span>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteFlight(flight.id)}
                          className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-8">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-amber-50 rounded-xl">
                    <Trophy className="w-5 h-5 text-amber-500" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-lg">{selectedYear} Top Cities</h3>
                </div>
                <div className="space-y-6">
                  {stats.topPlaces.length > 0 ? stats.topPlaces.map((place, idx) => (
                    <div key={place.name} className="space-y-3">
                      <div className="flex justify-between items-end">
                        <span className="font-bold text-slate-700 text-sm">{idx + 1}. {place.name}</span>
                        <span className="text-slate-400 text-xs font-bold">{place.count} {place.count === 1 ? 'Flight' : 'Flights'}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-blue-600 h-full rounded-full transition-all duration-1000 shadow-sm" 
                          style={{ width: `${(place.count / (stats.totalFlights || 1)) * 100}%` }}
                        />
                      </div>
                    </div>
                  )) : (
                    <div className="text-slate-400 text-sm italic py-4">
                      Leaderboard will update once you log flights for this period.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-3xl p-8 border border-slate-200 overflow-hidden relative group">
                <div className="relative z-10">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-indigo-50 rounded-xl">
                      <Globe className="w-5 h-5 text-indigo-500" />
                    </div>
                    <h3 className="font-bold text-slate-900">Total Reach</h3>
                  </div>
                  <div className="text-5xl font-black text-slate-900 mb-2">{stats.uniqueDestinations}</div>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Cities Conquered</p>
                </div>
                <div className="absolute -bottom-10 -right-10 opacity-5 group-hover:opacity-10 transition-opacity">
                  <Globe className="w-48 h-48" />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in slide-in-from-bottom duration-500">
            <div className="flex items-center justify-between px-2">
               <h2 className="text-2xl font-black text-slate-900">Yearly Recap Gallery</h2>
               <p className="text-slate-500 font-medium">Historical performance at a glance</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {/* All Time Milestone Card */}
               <div className="bg-slate-900 rounded-[32px] p-8 text-white relative overflow-hidden group border border-slate-800">
                  <div className="relative z-10 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-black uppercase tracking-widest text-blue-400">Milestone</span>
                        <Globe className="w-6 h-6 text-blue-400" />
                      </div>
                      <h3 className="text-3xl font-black mb-1 italic">ALL TIME</h3>
                      <p className="text-slate-400 font-medium text-sm">Full Travel History</p>
                    </div>
                    <div className="mt-8 space-y-4">
                      <div className="flex justify-between items-end border-b border-slate-800 pb-3">
                         <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Flights</span>
                         <span className="text-2xl font-black">{flights.length}</span>
                      </div>
                      <button 
                        onClick={() => { setSelectedYear('All Time'); setViewMode('timeline'); }}
                        className="w-full py-3 bg-white text-slate-900 font-black rounded-xl text-sm transition-all hover:bg-blue-500 hover:text-white"
                      >
                        View Lifetime Log
                      </button>
                    </div>
                  </div>
                  <div className="absolute -bottom-10 -right-10 opacity-10 group-hover:scale-110 transition-transform">
                    <Plane className="w-48 h-48" />
                  </div>
               </div>

               {/* Yearly Recap Cards */}
               {yearlyRecaps.map(recap => (
                 <div 
                  key={recap.year} 
                  onClick={() => { setSelectedYear(recap.year); setViewMode('timeline'); }}
                  className="bg-white rounded-[32px] p-8 border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-500 transition-all group cursor-pointer flex flex-col justify-between"
                 >
                    <div>
                       <div className="flex items-center justify-between mb-4">
                         <h3 className="text-3xl font-black text-slate-900 italic">{recap.year}</h3>
                         <div className="p-2 bg-blue-50 rounded-xl group-hover:bg-blue-600 transition-colors">
                           <Navigation className="w-5 h-5 text-blue-600 group-hover:text-white" />
                         </div>
                       </div>
                       <div className="grid grid-cols-2 gap-4 mt-6">
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Flights</span>
                            <span className="text-xl font-black text-slate-900">{recap.totalFlights}</span>
                          </div>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cities</span>
                            <span className="text-xl font-black text-slate-900">{recap.uniqueDestinations}</span>
                          </div>
                       </div>
                    </div>
                    <div className="mt-8">
                       <div className="flex items-center gap-2 mb-2">
                         <Trophy className="w-3.5 h-3.5 text-amber-500" />
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Top Destination</span>
                       </div>
                       <p className="text-lg font-bold text-slate-800">{recap.topDestination}</p>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        )}
      </main>

      {/* Add Flight Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-[32px] w-full max-w-xl shadow-2xl animate-in fade-in zoom-in duration-300 overflow-hidden border border-white/10">
            
            {/* Modal Navigation */}
            <div className="flex bg-slate-50 border-b border-slate-200 p-2 gap-2">
              <button 
                onClick={() => setModalTab('smart')}
                className={`flex-1 py-4 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all ${modalTab === 'smart' ? 'text-blue-600 bg-white shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Zap className="w-5 h-5" /> Magic Paste
              </button>
              <button 
                onClick={() => setModalTab('manual')}
                className={`flex-1 py-4 font-bold rounded-2xl flex items-center justify-center gap-2 transition-all ${modalTab === 'manual' ? 'text-blue-600 bg-white shadow-sm ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <History className="w-5 h-5" /> Manual Entry
              </button>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-4 text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-10">
              {modalTab === 'smart' ? (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Magic Input</h3>
                    <p className="text-slate-500 font-medium mb-6 leading-relaxed">Simply paste your flight details or a natural sentence. Our AI will handle the rest.</p>
                    <div className="relative">
                      <textarea 
                        autoFocus
                        className="w-full h-44 p-6 bg-white border-2 border-slate-200 text-slate-900 rounded-[24px] focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all resize-none font-semibold text-lg placeholder:text-slate-300"
                        placeholder="e.g. Flew with Delta from Atlanta to San Francisco on March 14th"
                        value={smartInput}
                        onChange={e => setSmartInput(e.target.value)}
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleSmartParse}
                    disabled={isParsing || !smartInput.trim()}
                    className="w-full py-5 bg-slate-900 text-white font-black text-lg rounded-[24px] shadow-xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:hover:bg-slate-900"
                  >
                    {isParsing ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Scanning Flight Data...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-6 h-6 text-amber-400" />
                        Analyze & Fill Form
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleAddFlight} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Departure</label>
                      <input 
                        required
                        type="text" 
                        onFocus={() => setActiveField('departure')}
                        placeholder="e.g. New York (JFK)"
                        className="w-full px-5 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold placeholder:text-slate-300"
                        value={newFlight.departure}
                        onChange={e => setNewFlight({...newFlight, departure: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Arrival</label>
                      <input 
                        required
                        type="text" 
                        onFocus={() => setActiveField('arrival')}
                        placeholder="e.g. Tokyo (NRT)"
                        className="w-full px-5 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold placeholder:text-slate-300"
                        value={newFlight.arrival}
                        onChange={e => setNewFlight({...newFlight, arrival: e.target.value})}
                      />
                    </div>
                  </div>

                  {/* Quick Select Presets */}
                  {frequentCities.length > 0 && (
                    <div className="animate-in fade-in slide-in-from-bottom duration-500">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3 ml-1">Frequent Points</label>
                      <div className="flex flex-wrap gap-2">
                        {frequentCities.map(city => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => {
                              if (activeField === 'arrival') setNewFlight({...newFlight, arrival: city});
                              else setNewFlight({...newFlight, departure: city});
                            }}
                            className="px-4 py-2.5 bg-slate-50 hover:bg-blue-600 hover:text-white text-slate-700 text-sm rounded-xl font-bold transition-all border border-slate-200 hover:border-blue-600 shadow-sm"
                          >
                            {city}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Date</label>
                      <input 
                        required
                        type="date" 
                        className="w-full px-5 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold"
                        value={newFlight.date}
                        onChange={e => setNewFlight({...newFlight, date: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-black text-slate-900 uppercase tracking-widest ml-1">Airline</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Lufthansa"
                        className="w-full px-5 py-4 bg-white border-2 border-slate-200 text-slate-900 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all font-bold placeholder:text-slate-300"
                        value={newFlight.airline}
                        onChange={e => setNewFlight({...newFlight, airline: e.target.value})}
                      />
                    </div>
                  </div>
                  
                  <button 
                    type="submit"
                    className="w-full py-5 bg-blue-600 text-white font-black text-xl rounded-[24px] shadow-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                  >
                    <Plane className="w-6 h-6" /> Log Journey
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);