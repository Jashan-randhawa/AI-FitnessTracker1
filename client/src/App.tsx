import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { useappcontext } from "./Context/AppContext";
import Loading from "./components/Loading";

const Layout = lazy(() => import("./Pages/Layout"));
const Dashboard = lazy(() => import("./Pages/Dashboard"));
const FoodLog = lazy(() => import("./Pages/FoodLog"));
const ActivityLog = lazy(() => import("./Pages/ActivityLog"));
const Profile = lazy(() => import("./Pages/Profile"));
const Blog = lazy(() => import("./Pages/Blog"));
const BlogPost = lazy(() => import("./Pages/BlogPost"));
const AIAssistant = lazy(() => import("./Pages/AIAssistant"));
const Weather = lazy(() => import("./Pages/Weather"));
const Workouts = lazy(() => import("./Pages/Workouts"));
const MealPlanner = lazy(() => import("./Pages/MealPlanner"));
const ActivityPlanner = lazy(() => import("./Pages/ActivityPlanner"));
const Login = lazy(() => import("./Pages/Login"));
const Onboarding = lazy(() => import("./Pages/Onboarding"));
const GoogleCallback = lazy(() => import("./Pages/GoogleCallback"));
const ForgotPassword = lazy(() => import("./Pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./Pages/ResetPassword"));

const App = () => {
  const { user, isUserFetched, onboardingCompleted } = useappcontext();

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/google-callback" element={<GoogleCallback />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

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
                  <Route path="food" element={<FoodLog />} />
                  <Route path="activity" element={<ActivityLog />} />
                  <Route path="blog" element={<Blog />} />
                  <Route path="blog/:id" element={<BlogPost />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="ai" element={<AIAssistant />} />
                  <Route path="weather" element={<Weather />} />
                  <Route path="workouts" element={<Workouts />} />
                  <Route path="planner" element={<MealPlanner />} />
                  <Route path="activity-planner" element={<ActivityPlanner />} />
                </Route>
              </Routes>
            )
          }
        />
      </Routes>
    </Suspense>
  );
};

export default App;
