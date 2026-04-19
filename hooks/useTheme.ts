import { useThemeContext } from '../context/ThemeContext';

/**
 * Custom hook to access the current theme colors and theme status.
 * Use this in functional components to get the colors for styling.
 */
export const useTheme = () => {
  const { colors, theme, isDark, setTheme, systemTheme } = useThemeContext();
  
  return {
    colors,
    theme,
    isDark,
    setTheme,
    systemTheme,
  };
};
