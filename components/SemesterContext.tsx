import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SemesterContextType = {
  selectedYear: string | null;
  selectedSemester: string | null;
  setYearAndSemester: (year: string, semester: string) => void;
  isLoaded: boolean;
};

const SemesterContext = createContext<SemesterContextType>({
  selectedYear: null,
  selectedSemester: null,
  setYearAndSemester: () => {},
  isLoaded: false,
});

export const useSemesterContext = () => useContext(SemesterContext);

export const SemesterProvider = ({ children }: { children: React.ReactNode }) => {
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadSavedState = async () => {
      try {
        const savedYear = await AsyncStorage.getItem('@selectedYear');
        const savedSemester = await AsyncStorage.getItem('@selectedSemester');
        
        if (savedYear && savedSemester) {
          setSelectedYear(savedYear);
          setSelectedSemester(savedSemester);
        }
      } catch (error) {
        console.error("Failed to load semester state", error);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSavedState();
  }, []);

  const setYearAndSemester = async (year: string, semester: string) => {
    setSelectedYear(year);
    setSelectedSemester(semester);
    try {
      await AsyncStorage.setItem('@selectedYear', year);
      await AsyncStorage.setItem('@selectedSemester', semester);
    } catch (error) {
      console.error("Failed to save semester state", error);
    }
  };

  return (
    <SemesterContext.Provider value={{ selectedYear, selectedSemester, setYearAndSemester, isLoaded }}>
      {children}
    </SemesterContext.Provider>
  );
};
