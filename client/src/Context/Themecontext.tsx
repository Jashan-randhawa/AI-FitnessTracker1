import {createContext, useContext, useEffect, useState} from 'react'

interface ThemeContextType {
    theme: String;
    toggleTheme: () => void;
} 

const themeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({children} : {children: React.ReactNode}) {


    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove(theme === 'light' ? 'dark' : 'light');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    } 
    return <themeContext.Provider value={{theme, toggleTheme}}>
        {children}
        </themeContext.Provider>
}

export function useTheme() {
   const  context = useContext(themeContext)
   if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
   }
   return context;
    }