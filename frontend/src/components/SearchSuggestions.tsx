import React, { useState } from "react";
import { Icon } from "@iconify/react";
import { useTranslation } from "react-i18next";
import {
  removeFromSearchHistory,
  clearSearchHistory,
} from "../utils/searchHistory";

interface SearchSuggestionsProps {
  suggestions: any[];
  loading: boolean;
  query: string;
  history: string[];
  onSelect: (item: string) => void;
  onClose?: () => void;
}

const SearchSuggestions: React.FC<SearchSuggestionsProps> = ({
  suggestions,
  loading,
  query,
  history,
  onSelect,
  onClose: _onClose
}) => {
  const { t } = useTranslation();
  const [historyItems, setHistoryItems] = useState<string[]>(history);

  const handleRemoveHistory = (item: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeFromSearchHistory(item);
    setHistoryItems((prev) => prev.filter((h) => h !== item));
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setHistoryItems([]);
  };

  const getIcon = (type: string) => {
    const icons: Record<string, { icon: string; color: string }> = {
      user: { icon: "mdi:account", color: "text-blue-500" },
      post: { icon: "mdi:file-document", color: "text-green-500" },
      tag: { icon: "mdi:pound", color: "text-purple-500" },
    };
    return icons[type] || icons.post;
  };

  return (
    <div className="absolute top-full mt-2 w-full bg-bg-secondary rounded-lg shadow-2xl border border-border overflow-hidden z-50 max-h-[500px] overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Icon
            icon="mdi:loading"
            width={32}
            className="animate-spin text-brand-primary"
          />
        </div>
      ) : (
        <>
          {/* Search History */}
          {!query && historyItems.length > 0 && (
            <div className="border-b border-border">
              <div className="flex items-center justify-between px-4 py-2 bg-bg-primary">
                <span className="text-sm font-semibold text-text-secondary">
                  {t('searchFilterBar.recentSearches')}
                </span>
                <button
                  onClick={handleClearHistory}
                  className="text-xs text-brand-primary hover:underline"
                >
                  {t('searchFilterBar.clearAll')}
                </button>
              </div>
              {historyItems.map((item, index) => (
                <button
                  key={index}
                  onClick={() => onSelect(item)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-tertiary transition-colors text-left group"
                >
                  <Icon
                    icon="mdi:history"
                    width={20}
                    className="text-text-muted"
                  />
                  <span className="flex-1 text-text-primary">
                    {item}
                  </span>
                  <button
                    onClick={(e) => handleRemoveHistory(item, e)}
                    className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-status-error transition-all"
                  >
                    <Icon icon="mdi:close" width={16} />
                  </button>
                </button>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {query && suggestions.length > 0 && (
            <div>
              <div className="px-4 py-2 bg-bg-primary">
                <span className="text-sm font-semibold text-text-secondary">
                  {t('searchFilterBar.suggestions')}
                </span>
              </div>
              {suggestions.map((suggestion) => {
                const iconData = getIcon(suggestion.type);
                return (
                  <button
                    key={suggestion.id}
                    onClick={() =>
                      onSelect(suggestion.query || suggestion.name)
                    }
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-tertiary transition-colors text-left"
                  >
                    <div className={`${iconData.color}`}>
                      <Icon icon={iconData.icon} width={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-text-primary truncate">
                        {suggestion.name || suggestion.title}
                      </p>
                      {suggestion.subtitle && (
                        <p className="text-sm text-text-muted truncate">
                          {suggestion.subtitle}
                        </p>
                      )}
                    </div>
                    {suggestion.count && (
                      <span className="text-xs text-text-muted">
                        {suggestion.count} {t('searchFilterBar.results')}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* No Results */}
          {query && !loading && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Icon
                icon="mdi:magnify"
                width={48}
                className="text-text-muted mb-3"
              />
              <p className="text-text-primary text-center">
                {t('searchFilterBar.noSuggestions', { query })}
              </p>
              <p className="text-sm text-text-muted text-center mt-1">
                {t('searchFilterBar.pressEnter')}
              </p>
            </div>
          )}

          {/* Empty State */}
          {!query && historyItems.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Icon
                icon="mdi:magnify"
                width={48}
                className="text-text-muted mb-3"
              />
              <p className="text-text-primary text-center">
                {t('searchFilterBar.startTyping')}
              </p>
              <p className="text-sm text-text-muted text-center mt-1">
                {t('searchFilterBar.trySearching')}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default SearchSuggestions;

