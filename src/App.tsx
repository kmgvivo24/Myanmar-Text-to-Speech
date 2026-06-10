import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Volume2, Play, Pause, Download, Sparkles, History, User, Music,
  Settings, RefreshCw, FileText, Trash2, Globe, VolumeX,
  Languages, Info, ChevronRight, Check, CheckCircle, Sliders, PlayCircle
} from "lucide-react";

// Prebuilt voices supported by gemini-3.1-flash-tts-preview
const PREBUILT_VOICES = [
  { id: "Kore", name: "Kore (ကိုရီ)", gender: "Female", description: "Warm, professional, balanced. Standard Burmese accent.", tagline: "Recommended Native", char: "K" },
  { id: "Puck", name: "Puck (ပတ်ခ်)", gender: "Male", description: "Cheerful, lively, and cordial. Perfect for greetings or storytelling.", tagline: "Bright & Warm", char: "P" },
  { id: "Charon", name: "Charon (ခရွန်)", gender: "Male", description: "Deep, resonant, melodic. Rich bass tone suitable for deep narrations.", tagline: "Deep & Melodic", char: "C" },
  { id: "Fenrir", name: "Fenrir (ဖန်နရီ)", gender: "Female", description: "Clear, authoritative, standard. Great for announcements or formal reading.", tagline: "Formal & Clear", char: "F" },
  { id: "Zephyr", name: "Zephyr (ဇက်ဖာ)", gender: "Female", description: "Soft, gentle, calm and peaceful. Excellent for guides and training.", tagline: "Gentle & Calming", char: "Z" },
];

const TONES = [
  { id: "neutral", label: "Neutral / Standard (မူလအတိုင်း)", desc: "Standard natural speaking tone" },
  { id: "cheerful", label: "Cheerful & Warm (ဖော်ရွေသော)", desc: "Lively, bright, and enthusiastic" },
  { id: "calm", label: "Calm & Relaxed (အေးဆေးငြိမ်သက်သော)", desc: "Serene, slow-paced, and peaceful" },
  { id: "energetic", label: "Energetic & Bold (တက်ကြွသော)", desc: "High conviction and positive push" },
  { id: "formal", label: "Formal & Elegant (ယဉ်ကျေးသိမ်မွေ့သော)", desc: "Standard literary/professional style" },
];

const SPEEDS = [
  { id: "slow", label: "Slow (0.8x)", value: "0.8x" },
  { id: "normal", label: "Normal (1.0x)", value: "1.0x" },
  { id: "fast", label: "Fast (1.25x)", value: "1.25x" },
];

const QUICK_PRESETS = [
  {
    label: "Greeting (နှုတ်ခွန်းဆက်)",
    text: "မင်္ဂလာပါရှင်၊ မြန်မာနိုင်ငံမှ နွေးထွေးစွာ ကြိုဆိုပါတယ်ဗျာ။ နေကောင်းကြရဲ့လားခင်ဗျာ။",
  },
  {
    label: "Formal Announcement (ကြေညာချက်)",
    text: "လူကြီးမင်းများခင်ဗျာ၊ ယခုတင်ပြမည့် သတင်းအချက်အလက်များကို ဂရုတစိုက် နားဆင်ပေးစေလိုပါတယ်။ ကျေးဇူးတင်ပါတယ်။",
  },
  {
    label: "Friendly Note (မိတ်ဆက်စကား)",
    text: "လှပသာယာတဲ့ ဒီနေ့လေးမှာ စိတ်၏ချမ်းသာခြင်း၊ ကိုယ်၏ကျန်းမာခြင်းတို့နဲ့ ပြည့်စုံပြီး ပျော်ရွှင်စရာအပြည့် ရှိပါစေရှင်။",
  },
  {
    label: "Help Prompt (လမ်းညွှန်ချက်)",
    text: "ကျေးဇူးပြု၍ ခဏလောက် စောင့်ဆိုင်းပေးပါ။ အခက်အခဲ တစ်စုံတစ်ရာ ရှိပါက ကျွန်ုပ်တို့ထံ ဆက်သွယ် စုံစမ်းမေးမြန်းနိုင်ပါတယ်။",
  },
];

interface AudioHistoryItem {
  id: string;
  text: string;
  voice: string;
  tone: string;
  speed: string;
  audioUrl: string;
  timestamp: string;
}

export default function App() {
  // TTS State
  const [inputText, setInputText] = useState("မင်္ဂလာပါ၊ မြန်မာစာမှ အသံသို့ ပြောင်းလဲပေးသော စနစ်မှ ကြိုဆိုပါသည်။ ဤစနစ်သည် နောက်ဆုံးပေါ် AI နည်းပညာကို အသုံးပြု၍ လူသားတစ်ဦးကဲ့သို့ သဘာဝကျသော အသံကို ထွက်ပေါ်စေပါသည်။");
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [selectedTone, setSelectedTone] = useState("neutral");
  const [selectedSpeed, setSelectedSpeed] = useState("normal");
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  // Translation State
  const [transInput, setTransInput] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationResult, setTranslationResult] = useState<{
    translatedText: string;
    explanation?: string;
  } | null>(null);

  // Audio Playback State
  const [currentAudio, setCurrentAudio] = useState<{
    audioUrl: string;
    text: string;
    voice: string;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0.85);

  // Settings State matching design
  const [pitchValue, setPitchValue] = useState(50);
  const [autoNormalize, setAutoNormalize] = useState(true);

  // History Log State (synchronized with localStorage)
  const [historyItems, setHistoryItems] = useState<AudioHistoryItem[]>([]);

  // Refs for audio handling and dynamic visualizer
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("my_tts_history");
      if (saved) {
        setHistoryItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Local history restore error:", e);
    }
  }, []);

  // Save history helper
  const saveHistory = (items: AudioHistoryItem[]) => {
    setHistoryItems(items);
    try {
      localStorage.setItem("my_tts_history", JSON.stringify(items));
    } catch (e) {
      console.error("Failed to persist history:", e);
    }
  };

  // Drag and Drop Text upload handling
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === "string") {
        setInputText(content);
      }
    };
    reader.readAsText(file);
  };

  // Convert Text to Speech action
  const handleGenerateTTS = async () => {
    if (!inputText || inputText.trim() === "") {
      setErrorStatus("စကားပြောရန် စာသားရိုက်ထည့်ပေးပါရှင် (Please insert text to continue).");
      return;
    }

    setIsLoading(true);
    setErrorStatus(null);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: inputText,
          voice: selectedVoice,
          tone: selectedTone,
          speed: selectedSpeed,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "မြန်မာအသံ ထုတ်လုပ်ရန် ခေတ္တအဆင်မပြေဖြစ်သွားပါသည်။ ပြန်လည်ကြိုးစားပေးပါ။");
      }

      // Set playback state
      const audioUrl = data.audioUrl;
      setCurrentAudio({
        audioUrl: audioUrl,
        text: inputText,
        voice: selectedVoice,
      });

      // Add to local history list
      const newItem: AudioHistoryItem = {
        id: "tts_" + Date.now(),
        text: inputText,
        voice: selectedVoice,
        tone: selectedTone,
        speed: selectedSpeed,
        audioUrl: audioUrl,
        timestamp: new Date().toLocaleTimeString("my-MM", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
      
      saveHistory([newItem, ...historyItems.slice(0, 19)]); // Store up to 20 items

      // Force play state on load
      setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.log("Auto-play blocked, wait for user interact.", e));
        }
      }, 100);

    } catch (err: any) {
      console.error(err);
      setErrorStatus(err.message || "အသံထုတ်လွှင့်မှုပြုလုပ်ရာတွင် အမှားတစ်ခုရှိနေပါသည်။ အင်တာနက်ချိတ်ဆက်မှုကို စစ်ဆေးပါ။");
    } finally {
      setIsLoading(false);
    }
  };

  // Translate / Polish helper
  const handleTranslatePolish = async () => {
    if (!transInput || transInput.trim() === "") {
      return;
    }

    setIsTranslating(true);
    setTranslationResult(null);

    try {
      const response = await fetch("/api/translate-polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transInput }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "ဘာသာပြန်ယူရန် ခေတ္တအဆင်မပြေဖြစ်သွားပါသည်။");
      }

      setTranslationResult({
        translatedText: data.translatedText,
        explanation: data.explanation,
      });

      // Set directly as input text
      setInputText(data.translatedText);
    } catch (err: any) {
      console.error(err);
      setErrorStatus("ဘာသာပြန်ရာတွင် ချို့ယွင်းချက်ရှိပါသည်: " + (err.message || ""));
    } finally {
      setIsTranslating(false);
    }
  };

  // Clear Input Editor
  const handleClearAll = () => {
    setInputText("");
    setTranslationResult(null);
  };

  // Play audio from history item directly
  const playHistoryAudio = (item: AudioHistoryItem) => {
    setCurrentAudio({
      audioUrl: item.audioUrl,
      text: item.text,
      voice: item.voice,
    });
    // Fill back editor so they can edit or see details easily
    setInputText(item.text);
    setSelectedVoice(item.voice);
    
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.play().catch(e => console.log("Play interrupted on history toggle", e));
      }
    }, 100);
  };

  // Remove single history log
  const deleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = historyItems.filter((i) => i.id !== id);
    saveHistory(filtered);
  };

  // Clear complete logs
  const clearAllHistoryLogs = () => {
    if (confirm("မှတ်တမ်းများအားလုံးကို အပြီးတိုင် ဖျက်ပစ်ရန် သေချာပါသလားဗျာ။ (Are you sure to clear all logs?)")) {
      saveHistory([]);
    }
  };

  // Volume adjuster
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setAudioVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  // Seek timeline adjuster
  const handleSeekTimeline = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pct = parseFloat(e.target.value);
    if (audioRef.current && audioDuration > 0) {
      const nextTime = (pct / 100) * audioDuration;
      audioRef.current.currentTime = nextTime;
      setAudioProgress(pct);
      setAudioCurrentTime(nextTime);
    }
  };

  // Sync state when native audio plays/pauses
  const onAudioTimeUpdate = () => {
    if (!audioRef.current) return;
    const cur = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setAudioCurrentTime(cur);
    if (dur > 0) {
      setAudioProgress((cur / dur) * 100);
    }
  };

  const onAudioLoaded = () => {
    if (!audioRef.current) return;
    setAudioDuration(audioRef.current.duration || 0);
  };

  const togglePlayState = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.log(e));
    }
  };

  // Audio Playback event listeners
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnd = () => {
      setIsPlaying(false);
      setAudioProgress(100);
    };

    el.addEventListener("play", handlePlay);
    el.addEventListener("pause", handlePause);
    el.addEventListener("ended", handleEnd);

    return () => {
      el.removeEventListener("play", handlePlay);
      el.removeEventListener("pause", handlePause);
      el.removeEventListener("ended", handleEnd);
    };
  }, [currentAudio]);

  // Audio Waveform dynamic Canvas Animation loop
  useEffect(() => {
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = canvas.width;
    let height = canvas.height;
    
    // Draw waves representing real-time audio
    let offset = 0;
    const barCount = 48;

    const render = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      offset += 0.15;
      
      // Background clean
      ctx.fillStyle = "rgba(255, 255, 255, 0)";
      ctx.fillRect(0, 0, width, height);

      // Create an elegant Indigo to Violet gradient to match Sleek Interface
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, "#4f46e5"); // Indigo-600
      grad.addColorStop(0.5, "#6366f1"); // Indigo-500
      grad.addColorStop(1, "#8b5cf6"); // Violet-500

      // Draw aesthetic audio lines
      const spacing = 4;
      const barWidth = (width - spacing * (barCount - 1)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + spacing);
        
        let multiplier = 0.1;
        if (isPlaying) {
          // Sync with math sine for smooth visualizer waving
          multiplier = Math.sin(offset + i * 0.25) * 0.45 + 0.55;
          multiplier += Math.sin(offset * 2.8 + i * 0.4) * 0.12;
        } else {
          // Stationary silent wave
          multiplier = Math.sin(i * 0.12) * 0.06 + 0.08;
        }

        const barHeight = multiplier * (height * 0.75);
        const y = (height - barHeight) / 2;

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, barHeight, 3);
        ctx.fill();
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [isPlaying]);

  // Handle browser resizing for audio canvas dimensions
  useEffect(() => {
    const handleResize = () => {
      const canvas = visualizerCanvasRef.current;
      if (canvas && canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth;
        canvas.height = 70;
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [currentAudio]);

  // Word & Character stats calculators
  const getStatsText = () => {
    const chars = inputText.length;
    const words = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
    return { chars, words };
  };

  const { chars, words } = getStatsText();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 antialiased selection:bg-indigo-100 flex flex-col font-sans">
      {/* Hidden native audio controller */}
      {currentAudio && (
        <audio
          id="native-audio"
          ref={audioRef}
          src={currentAudio.audioUrl}
          onTimeUpdate={onAudioTimeUpdate}
          onLoadedMetadata={onAudioLoaded}
          className="hidden"
        />
      )}

      {/* Navigation Header from Sleek Interface theme */}
      <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sm:px-8 shrink-0 sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-extrabold text-slate-800 tracking-tight font-display">BurmaEcho TTS</span>
            <span className="text-[10px] text-slate-400 font-bold tracking-wider uppercase -mt-1 hidden sm:block">Myanmar Text to Speech</span>
          </div>
          <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-indigo-100 ml-1">
            v2.4 PRO
          </span>
        </div>

        <div className="hidden md:flex gap-6 text-sm font-semibold text-slate-600">
          <a href="#" className="text-indigo-600 border-b-2 border-indigo-600 py-5 px-1">Studio Dashboard</a>
          <a href="#" className="hover:text-indigo-600 transition py-5 px-1">Voice Library</a>
          <a href="#" className="hover:text-indigo-600 transition py-5 px-1">API Keys</a>
          <a href="#" className="hover:text-indigo-600 transition py-5 px-1">Help Docs</a>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col items-end text-right">
            <span className="text-xs sm:text-sm font-bold text-slate-800">komgvivo24@gmail.com</span>
            <span className="text-[10px] sm:text-xs text-slate-400 font-semibold uppercase tracking-wider">Enterprise Plan</span>
          </div>
          <div className="w-9 h-9 rounded-full bg-indigo-100 border-2 border-white shadow-sm flex items-center justify-center text-indigo-700 font-bold text-sm">
            K
          </div>
        </div>
      </nav>

      {/* Main Responsive Layout Wrapper */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 overflow-hidden">
        
        {/* LEFT COLUMN: Workspace + Translator Helper */}
        <div className="flex-1 flex flex-col gap-6">
          
          {/* Quick Informational Sparkle Banner with Sleek Aesthetic */}
          <div className="bg-gradient-to-r from-indigo-900 to-indigo-700 rounded-2xl p-5 text-white shadow-md relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1 z-10">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/10 text-indigo-200 border border-white/10 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm">
                <Sparkles className="w-3 h-3 mr-1 text-indigo-200 fill-indigo-200" />
                Sleek BurmaEcho Model
              </span>
              <h2 className="text-lg font-bold tracking-tight">မြန်မာစာသားများကို သဘာဝကျကျ အသံပြောင်းလဲပါ။</h2>
              <p className="text-xs text-indigo-100 leading-relaxed font-normal">
                Unicode standard text is converted using real-time premium vocals featuring adjustable pace, custom tone, and history replication.
              </p>
            </div>
            <div className="shrink-0 z-10 flex gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-500/20 text-indigo-200 border border-indigo-400/20">
                <Globe className="w-3.5 h-3.5 mr-1" /> Uni MM
              </span>
            </div>
          </div>

          {/* Translation Assistant Portal */}
          <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 md:p-6 transition-all duration-300">
            <div className="flex items-center space-x-2.5 pb-4 border-b border-slate-100">
              <Languages className="w-4.5 h-4.5 text-indigo-600" />
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Myanmar Translation & Text Enhancer Helper</h3>
            </div>
            
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">English Input / Casual Burmese Draft</label>
                <div className="relative">
                  <textarea
                    value={transInput}
                    onChange={(e) => setTransInput(e.target.value)}
                    placeholder="e.g.: 'Welcome to Myanmar, hope you have a nice trip' or write casual Burmese you want polished."
                    rows={2}
                    className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-3 pr-10 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
                  />
                  <button
                    onClick={handleTranslatePolish}
                    disabled={isTranslating || !transInput.trim()}
                    className="absolute right-2 bottom-2 inline-flex items-center justify-center p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-100 disabled:text-slate-400 transition"
                    title="Translate or Enhance to Standard Burmese"
                  >
                    {isTranslating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 leading-normal">
                  Let Gemini translate or polish your text to standard Myanmar script instantly. It will automatically populate the TTS workshop workspace below!
                </p>
              </div>

              {/* Translation Output Bubble */}
              <div className="bg-indigo-50/20 rounded-xl p-4 border border-indigo-100/50 flex flex-col justify-between">
                <div>
                  <span className="inline-flex items-center text-[10px] font-bold text-indigo-800 space-x-1 uppercase tracking-wider mb-2">
                    <CheckCircle className="w-3 h-3 text-indigo-600 mr-1" />
                    <span>Interactive Assistant Result</span>
                  </span>
                  
                  {translationResult ? (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-slate-950 italic">
                        "{translationResult.translatedText}"
                      </p>
                      {translationResult.explanation && (
                        <p className="text-[10px] text-slate-650 leading-snug">
                          <strong className="text-slate-700">English context:</strong> {translationResult.explanation}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 leading-relaxed italic py-2">
                      Write English phrasing on the left sidebar input and press translate to see the polished Burmese script.
                    </p>
                  )}
                </div>
                
                {translationResult && (
                  <div className="mt-2 flex justify-end">
                    <span className="text-[9px] text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center">
                      <Check className="w-2.5 h-2.5 mr-1" /> Loaded to Voice Area
                    </span>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* TTS Workspace (Input Text) - Sleek White Panel block */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xs font-bold text-slate-700 uppercase tracking-wider">စာသားထည့်သွင်းရန် (Input Text)</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleClearAll}
                  className="px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200 rounded transition"
                >
                  Clear
                </button>
                <label className="px-3 py-1 text-xs font-medium text-slate-500 hover:bg-slate-200 rounded cursor-pointer transition flex items-center">
                  <FileText className="w-3 h-3 mr-1 text-slate-400" />
                  Upload .txt
                  <input
                    type="file"
                    accept=".txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              className="w-full min-h-[180px] p-6 text-sm text-slate-800 focus:outline-none resize-none leading-relaxed font-sans placeholder:text-slate-400 bg-white"
              placeholder="မြန်မာစာသားများကို ဤနေရာတွင် ရိုက်ထည့်ပါ..."
            />

            {/* Quick Word Counts */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-xs text-slate-400">
              <div className="flex space-x-3">
                <span>Character count: <strong>{chars}</strong> / 1,500</span>
                <span>•</span>
                <span>Words count: <strong>{words}</strong></span>
              </div>
              <span className="bg-slate-200/80 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold">Language: Myanmar (Unicode)</span>
            </div>

            {/* Quick Presets Tags Bar inside Workspace */}
            <div className="p-4 bg-slate-50/30 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-1.5">Presets:</span>
              {QUICK_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  onClick={() => setInputText(preset.text)}
                  className="text-[11px] px-2.5 py-1 rounded bg-white border border-slate-200 text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Core Sleek Control Track Player (vocal player bar at bottom) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
            
            {/* Visualizer and stats */}
            <div className="flex-1 w-full space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-slate-500 flex items-center">
                  <Sliders className="w-3.5 h-3.5 mr-1 text-slate-400" />
                  Current Coversion Stream Track
                </span>
                <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider flex items-center">
                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isPlaying ? "bg-indigo-600 animate-ping" : "bg-slate-400"}`}></span>
                  {isLoading ? "Synthesizing..." : isPlaying ? "Streaming Voice" : currentAudio ? "Ready to Play" : "No Stream Loaded"}
                </span>
              </div>

              {/* Range Timeline seek */}
              <div className="w-full pt-1.5 space-y-1">
                {currentAudio ? (
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={audioProgress}
                    onChange={handleSeekTimeline}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                  />
                ) : (
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="w-0 h-full bg-indigo-600 rounded-full"></div>
                  </div>
                )}
                
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span>{Math.floor(audioCurrentTime)}s Time elapsed</span>
                  {currentAudio && (
                    <span className="italic font-normal max-w-[200px] truncate text-slate-400">Voice: {currentAudio.voice}</span>
                  )}
                  <span>{Math.floor(audioDuration)}s Maximum length</span>
                </div>
              </div>
            </div>

            {/* Play Actions Buttons Group */}
            <div className="flex items-center gap-3.5">
              
              {/* Reset generator button (acts as backup trigger/synthesizer) */}
              <button
                onClick={handleGenerateTTS}
                disabled={isLoading || !inputText.trim()}
                className="w-12 h-12 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:border-indigo-500 hover:text-indigo-600 disabled:bg-slate-50 disabled:text-slate-350 transition-all shadow-inner"
                title="Synthesize and Regenerate Raw Voice Audio Stream"
              >
                {isLoading ? (
                  <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                )}
              </button>

              {/* Big primary round Play button from Sleek instructions */}
              <button
                onClick={currentAudio ? togglePlayState : handleGenerateTTS}
                disabled={isLoading || (!currentAudio && !inputText.trim())}
                className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-600/10 hover:scale-105 active:scale-95 group disabled:bg-slate-200 disabled:shadow-none"
                title={currentAudio ? (isPlaying ? "Pause Stream" : "Play Stream") : "Convert & Play now"}
              >
                {isPlaying ? (
                  <div className="flex gap-1 items-center justify-center">
                    <div className="w-1 h-5 bg-white rounded-full"></div>
                    <div className="w-1 h-5 bg-white rounded-full"></div>
                  </div>
                ) : (
                  <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1.5" />
                )}
              </button>

              {/* Elegant download trigger */}
              {currentAudio ? (
                <a
                  href={currentAudio.audioUrl}
                  download={`burma_echo_${currentAudio.voice}.wav`}
                  className="w-12 h-12 rounded-full border border-slate-200 bg-white flex items-center justify-center hover:border-indigo-500 hover:text-indigo-600 text-slate-600 transition"
                  title="Download vocal PCM file as standard quality WAV"
                >
                  <Download className="w-5 h-5" />
                </a>
              ) : (
                <button
                  disabled
                  className="w-12 h-12 rounded-full border border-slate-100 bg-slate-50/50 flex items-center justify-center text-slate-300 pointer-events-none"
                >
                  <Download className="w-5 h-5" />
                </button>
              )}
            </div>

          </div>

          {errorStatus && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold flex items-center space-x-2">
              <Info className="w-4 h-4 shrink-0" />
              <span>{errorStatus}</span>
            </div>
          )}

        </div>

        {/* RIGHT SIDEBAR COLUMN: Voice Selector + Customizable Settings Profile */}
        <aside className="w-full lg:w-80 flex flex-col gap-6 shrink-0">
          
          {/* Custom Voice selector with material look */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">အသံရွေးချယ်မှု (Voice Model)</h3>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {PREBUILT_VOICES.map((v) => {
                const isSelected = selectedVoice === v.id;
                return (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVoice(v.id)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                      isSelected
                        ? "border-indigo-500 bg-indigo-50/30"
                        : "border-slate-100 bg-white hover:border-slate-300"
                    }`}
                  >
                    {/* Tiny visual circle with user profile char */}
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold font-display ${
                      v.gender === "Female" ? "bg-indigo-600" : "bg-violet-600"
                    }`}>
                      {v.char}
                    </div>

                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-slate-800">{v.name}</p>
                      <p className="text-[10px] text-slate-500 italic leading-snug">{v.gender} · {v.tagline}</p>
                    </div>

                    {isSelected && (
                      <div className="ml-auto text-indigo-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Settings Options (Sliders parameters matching design layout) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-5">Settings (ချိန်ညှိချက်များ)</h3>
            
            <div className="space-y-5">
              
              {/* Speaking Tone custom selector */}
              <div>
                <div className="flex justify-between mb-2 text-xs font-medium text-slate-650">
                  <span>Emotion/Tone (အသံ လေယူလေသိမ်း)</span>
                </div>
                <select
                  value={selectedTone}
                  onChange={(e) => setSelectedTone(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 bg-slate-50 p-2 font-bold text-slate-700 outline-none focus:border-indigo-500 transition"
                >
                  {TONES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Speed Factor */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Speed Pace (အမြန်နှုန်း)</span>
                  <span className="text-xs font-bold text-indigo-600 capitalize">
                    {selectedSpeed === "normal" ? "1.0x (Normal)" : selectedSpeed === "slow" ? "0.8x (Slow)" : "1.25x (Fast)"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {SPEEDS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedSpeed(s.id)}
                      className={`py-1.5 text-[10px] font-bold rounded-lg border text-center transition ${
                        selectedSpeed === s.id
                          ? "border-indigo-500 bg-indigo-50/40 text-indigo-700"
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {s.value}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic pitch level slider (decorative setting modeled directly from design) */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Pitch Modulate (အသံနေအထား)</span>
                  <span className="text-xs font-bold text-indigo-600">
                    {pitchValue === 50 ? "Default" : pitchValue < 50 ? `-${50 - pitchValue}` : `+${pitchValue - 50}`}
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={pitchValue}
                  onChange={(e) => setPitchValue(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-100 rounded-lg appearance-none"
                />
              </div>

              {/* Audio Volume range slider */}
              <div>
                <div className="flex justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600">Volume Level (အကျယ်)</span>
                  <span className="text-xs font-bold text-indigo-600">{Math.round(audioVolume * 100)}%</span>
                </div>
                <div className="flex items-center space-x-2">
                  {audioVolume === 0 ? (
                    <VolumeX className="w-4 h-4 text-slate-400" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-indigo-600" />
                  )}
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={audioVolume}
                    onChange={handleVolumeChange}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg appearance-none"
                  />
                </div>
              </div>

              {/* Advanced auto normalization checkbox option */}
              <div className="pt-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mb-2">Advanced Tone Options</p>
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoNormalize}
                    onChange={(e) => setAutoNormalize(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 accent-indigo-600"
                  />
                  <span className="text-xs font-medium text-slate-600 leading-normal">Auto-Normalize Voice Audio</span>
                </label>
              </div>

            </div>

            {/* Audio waveform visualization placeholder */}
            {currentAudio && (
              <div className="mt-4 pt-1 flex items-center justify-center">
                <div className="relative w-full rounded-lg bg-indigo-50/10 border border-slate-100 p-2 overflow-hidden flex items-center">
                  <canvas ref={visualizerCanvasRef} className="w-full h-11 block" />
                </div>
              </div>
            )}
          </div>

          {/* History logs card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex-1 flex flex-col min-h-[190px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center">
                <History className="w-4 h-4 mr-1.5 text-indigo-600" />
                Recent Captures (လတ်တလော မှတ်တမ်း)
              </span>
              {historyItems.length > 0 && (
                <button
                  onClick={clearAllHistoryLogs}
                  className="text-[10px] font-bold text-slate-400 hover:text-red-500 transition"
                >
                  Clear
                </button>
              )}
            </div>

            {historyItems.length > 0 ? (
              <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                {historyItems.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => playHistoryAudio(item)}
                    className="p-2.5 rounded-xl border border-slate-150 bg-slate-50/20 hover:border-indigo-400 hover:bg-indigo-50/10 transition flex items-center justify-between cursor-pointer"
                  >
                    <div className="space-y-0.5 truncate pr-2 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate">
                        {item.text}
                      </p>
                      <div className="flex items-center space-x-1.5 text-[9px] font-bold text-slate-400">
                        <span className="bg-slate-200/80 px-1 py-0.2 rounded text-[8px] text-slate-500 uppercase">{item.voice}</span>
                        <span>{item.timestamp}</span>
                      </div>
                    </div>
                    
                    <button
                      className="p-1 rounded bg-white hover:bg-indigo-600 hover:text-white transition shadow-sm"
                      title="Replay instantly"
                    >
                      <Play className="w-3 h-3 fill-current text-indigo-600 hover:text-white" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="my-auto text-center py-4 text-slate-400">
                <p className="text-xs font-semibold">မှတ်တမ်းမရှိသေးပါ။</p>
                <p className="text-[10px] text-slate-400 italic">No previous conversions stored locally yet.</p>
              </div>
            )}
            
            <div className="mt-4 pt-4 border-t border-slate-150">
              <button
                onClick={handleGenerateTTS}
                disabled={isLoading || !inputText.trim()}
                className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-black transition-all flex items-center justify-center space-x-2 shadow-sm disabled:bg-slate-100 disabled:text-slate-400"
              >
                {isLoading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PlayCircle className="w-3.5 h-3.5" />
                )}
                <span>Batch Vocal Conversion</span>
              </button>
            </div>
          </div>

        </aside>

      </main>

      {/* Footer block */}
      <footer className="bg-slate-900 text-slate-400 border-t border-slate-800 py-6 px-6 mt-12 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between text-xs space-y-3 md:space-y-0 opacity-90">
          <div className="space-y-1 text-center md:text-left">
            <p className="font-bold text-slate-200 font-display">BurmaEcho Myanmar Text-to-Speech Web Console</p>
            <p className="text-slate-500">Built using the Google GenAI TypeScript SDK, gemini-3.1-flash-tts-preview & gemini-3.5-flash.</p>
          </div>
          <div className="flex items-center space-x-4 font-semibold text-[11px]">
            <span>© 2026 AI Studio</span>
            <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
            <span className="text-slate-300">Created by MMITSG</span>
            <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
            <span className="text-indigo-400 flex items-center">
              <Globe className="w-3.5 h-3.5 mr-1" /> MM Unicode Standard
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
