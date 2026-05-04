export type IconName =
  | 'home' | 'chart' | 'tag' | 'gear' | 'plus' | 'minus' | 'back' | 'forward'
  | 'barcode' | 'search' | 'more' | 'check' | 'flame' | 'leaf' | 'fish' | 'drop'
  | 'calendar' | 'edit' | 'trend-up' | 'briefcase' | 'home-s' | 'users' | 'plane'
  | 'sun' | 'moon' | 'coffee' | 'pizza' | 'cup' | 'cookie' | 'sparkle' | 'target' | 'streak' | 'trash'

type Props = {
  name: IconName
  size?: number
  stroke?: number
  color?: string
}

export function Icon({ name, size = 20, stroke = 1.8, color = 'currentColor' }: Props) {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth: stroke,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (name) {
    case 'home': return (<svg {...props}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></svg>)
    case 'chart': return (<svg {...props}><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 15v-4"/><path d="M12 15V8"/><path d="M16 15v-6"/></svg>)
    case 'tag': return (<svg {...props}><path d="M3 12V4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="7.5" r="1.2" fill={color}/></svg>)
    case 'gear': return (<svg {...props}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>)
    case 'plus': return (<svg {...props}><path d="M12 5v14M5 12h14"/></svg>)
    case 'minus': return (<svg {...props}><path d="M5 12h14"/></svg>)
    case 'back': return (<svg {...props}><path d="M15 18l-6-6 6-6"/></svg>)
    case 'forward': return (<svg {...props}><path d="M9 18l6-6-6-6"/></svg>)
    case 'barcode': return (<svg {...props}><path d="M3 7v10M6 7v10M9 7v10M13 7v10M17 7v10M20 7v10"/></svg>)
    case 'search': return (<svg {...props}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>)
    case 'more': return (<svg {...props}><circle cx="5" cy="12" r="1.4" fill={color}/><circle cx="12" cy="12" r="1.4" fill={color}/><circle cx="19" cy="12" r="1.4" fill={color}/></svg>)
    case 'check': return (<svg {...props}><path d="M5 12l5 5 9-11"/></svg>)
    case 'flame': return (<svg {...props}><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4-.5 2 .5 3 2 3 0-3-1-5 1-9z"/></svg>)
    case 'leaf': return (<svg {...props}><path d="M5 19c0-8 6-14 14-14 0 8-6 14-14 14z"/><path d="M5 19c4-4 8-7 14-14"/></svg>)
    case 'fish': return (<svg {...props}><path d="M3 12s3-5 9-5 8 5 8 5-2 5-8 5-9-5-9-5z"/><circle cx="16" cy="11" r="0.8" fill={color}/><path d="M3 12l-1-2 0 4z" fill={color}/></svg>)
    case 'drop': return (<svg {...props}><path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/></svg>)
    case 'calendar': return (<svg {...props}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>)
    case 'edit': return (<svg {...props}><path d="M14 4l6 6-11 11H3v-6L14 4z"/></svg>)
    case 'trend-up': return (<svg {...props}><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>)
    case 'briefcase': return (<svg {...props}><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>)
    case 'home-s': return (<svg {...props}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-16a1 1 0 0 1-1-1z"/></svg>)
    case 'users': return (<svg {...props}><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.2"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5"/><path d="M15 20c0-2 2-4 5-4"/></svg>)
    case 'plane': return (<svg {...props}><path d="M3 13l8-3 0-6 2 0 0 5 7-2 1 2-7 4 0 6-2 1 0-6-7 2z"/></svg>)
    case 'sun': return (<svg {...props}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/></svg>)
    case 'moon': return (<svg {...props}><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>)
    case 'coffee': return (<svg {...props}><path d="M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"/><path d="M17 9h2a2 2 0 0 1 0 5h-2"/><path d="M7 4v2M11 4v2"/></svg>)
    case 'pizza': return (<svg {...props}><path d="M12 3l9 16H3z"/><circle cx="10" cy="13" r="1" fill={color}/><circle cx="14" cy="11" r="1" fill={color}/></svg>)
    case 'cup': return (<svg {...props}><path d="M5 4h14l-1 16a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M5 8h14"/></svg>)
    case 'cookie': return (<svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="0.8" fill={color}/><circle cx="14" cy="13" r="0.8" fill={color}/><circle cx="10" cy="15" r="0.8" fill={color}/></svg>)
    case 'sparkle': return (<svg {...props}><path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M6 18l3-3M15 9l3-3"/></svg>)
    case 'target': return (<svg {...props}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill={color}/></svg>)
    case 'streak': return (<svg {...props}><path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4-.5 2 .5 3 2 3 0-3-1-5 1-9z"/></svg>)
    case 'trash': return (<svg {...props}><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M10 11v7M14 11v7"/></svg>)
    default: return null
  }
}
