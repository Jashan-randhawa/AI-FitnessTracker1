import { useEffect, useState } from "react";
import api from "../../configs/api";

/** Loads the user's active workout plan for FitBot's plan-aware suggestions. */
export function useActiveWorkoutPlan() {
  const [activePlan, setActivePlan] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    let isMounted = true;
    api
      .get("/api/workout-plans/active")
      .then((res) => {
        if (isMounted && res.data?.plan) {
          setActivePlan(res.data.plan);
        }
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  return activePlan;
}
