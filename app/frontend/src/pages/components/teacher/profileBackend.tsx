/*import { useEffect, useState } from "react";
import { API, Auth } from "aws-amplify";
import { getTeacherProfile } from "../graphql/queries"; // your AppSync query

const [profile, setProfile] = useState(null);

useEffect(() => {
  const fetchProfile = async () => {
    const user = await Auth.currentAuthenticatedUser();
    const { data } = await API.graphql({
      query: getTeacherProfile,
      variables: { id: user.username },
    });
    setProfile(data.getTeacherProfile);
  };
  fetchProfile();
}, []);*/
