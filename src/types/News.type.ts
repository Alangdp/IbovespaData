export interface News {
  title: string
  published: number
  sponsor: string
  symbols: string[]
  symbolsSVG: (string | undefined)[]

  // Optional
  link?: string
  secondary_link?: string
  content?: string[]
}

export interface User {
  is_authenticated: boolean
  is_moderator: boolean
  is_staff: boolean
  features: {
    NO_SPONSORED_ADS: boolean
  }
  settings: {
    'News.displayMode': unknown
  }
}

export interface RelatedSymbol {
  symbol: string
  logoid?: string
  'currency-logoid'?: string
  'base-currency-logoid'?: string
}

export interface Item {
  id: string
  title: string
  storyPath: string
  sourceLogoId: string
  published: number
  source: string
  urgency: number
  permission?: string
  provider: string
  relatedSymbols: RelatedSymbol[]
  link?: string
}

export interface Widget {
  data_path: string
  title: string
  id: string
  is_hidden_title: boolean
}

export interface NewsTab {
  data_path: string
  title: string
  id: string
  is_hidden_title: boolean
}

export interface NewsAPI {
  [code: string]: {
    context: {
      request_context: {
        user: User
        locale: string
        language_iso: string
      }
    }
    data: {
      news: {
        data: {
          items: Item[]
        }
      }
    }
    meta: {
      widgets: Widget[]
      news_tabs: NewsTab[]
      news_active_tab_id: string
    }
    ssrTimeSeconds: number
  }
}
