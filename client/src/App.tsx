import { Route, Routes } from "react-router-dom";
import Layout from "./Pages/Layout";
import Dashboard from "./Pages/Dashboard";
import FoodLog from "./Pages/FoodLog";
import ActivityLog from "./Pages/ActivityLog";
import Profile from "./Pages/Profile";
import Blog from "./Pages/Blog";
import BlogPost from "./Pages/BlogPost";
import AIAssistant from "./Pages/AIAssistant";
import Weather from "./Pages/Weather";
import Workouts from "./Pages/Workouts";
import MealPlanner from "./Pages/MealPlanner";
import ActivityPlanner from "./Pages/ActivityPlanner";
import Spotify from "./Pages/Spotify";
import { useappcontext } from "./Context/AppContext";
import Login from "./Pages/Login";
import Loading from "./components/Loading";
import Onboarding from "./Pages/Onboarding";
import GoogleCallback from "./Pages/GoogleCallback";
import ForgotPassword from "./Pages/ForgotPassword";
import ResetPassword from "./Pages/ResetPassword";

const App = () => {
  const { user, isUserFetched, onboardingCompleted } = useappcontext();

  return (
    <Routes>
      <Route path="/google-callback" element={<GoogleCallback />} />
      <Route path="/forgot-password"  element={<ForgotPassword />} />
      <Route path="/reset-password"   element={<ResetPassword />} />

      <Route
        path="/*"
        element={
          !user ? (
            isUserFetched ? <Login /> : <Loading />
          ) : !onboardingCompleted ? (
            <Onboarding />
          ) : (
            <Routes>
              <Route path="/" element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="food"        element={<FoodLog />} />
                <Route path="activity"    element={<ActivityLog />} />
                <Route path="blog"        element={<Blog />} />
                <Route path="blog/:id"    element={<BlogPost />} />
                <Route path="profile"     element={<Profile />} />
                <Route path="ai"          element={<AIAssistant />} />
                <Route path="weather"     element={<Weather />} />
                <Route path="workouts"    element={<Workouts />} />
                <Route path="planner"     element={<MealPlanner />} />
                <Route path="activity-planner" element={<ActivityPlanner />} />
                <Route path="spotify"         element={<Spotify />} />
              </Route>
            </Routes>
          )
        }
      />
    </Routes>
  );
};

export default App;
