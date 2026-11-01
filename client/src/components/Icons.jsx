const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

export const Icon = {
  Cross: (p) => (<svg {...base} width={18} height={18} {...p}><path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" fill="currentColor" stroke="none" /></svg>),
  User: (p) => (<svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" /></svg>),
  Stethoscope: (p) => (<svg {...base} {...p}><path d="M5 3v6a5 5 0 0 0 10 0V3" /><path d="M10 14v2a5 5 0 0 0 10 0v-2" /><circle cx="20" cy="12" r="2" /></svg>),
  Arrow: (p) => (<svg {...base} width={18} height={18} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>),
  Back: (p) => (<svg {...base} width={18} height={18} {...p}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>),
  Mic: (p) => (<svg {...base} width={18} height={18} {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>),
  Check: (p) => (<svg {...base} width={14} height={14} strokeWidth={3} {...p}><path d="M5 12l5 5 9-10" /></svg>),
  CheckCircle: (p) => (<svg {...base} width={40} height={40} {...p}><circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6.5" /></svg>),
  Alert: (p) => (<svg {...base} width={32} height={32} {...p}><path d="M12 3l10 18H2z" /><path d="M12 10v4M12 17.5v.01" /></svg>),
  Info: (p) => (<svg {...base} width={20} height={20} {...p}><circle cx="12" cy="12" r="10" /><path d="M12 11v6M12 7.5v.01" /></svg>),
  Lock: (p) => (<svg {...base} width={18} height={18} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>),
  ThumbUp: (p) => (<svg {...base} width={20} height={20} {...p}><path d="M7 10v11H3V10zM7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18 21H7" /></svg>),
  Edit: (p) => (<svg {...base} width={16} height={16} {...p}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>),
  Sparkle: (p) => (<svg {...base} width={14} height={14} {...p}><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" /></svg>),
};
