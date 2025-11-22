import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { signOut } from "aws-amplify/auth";


  async function handleLogout(){
    try {
      await signOut();
      
      window.location.href = "/role"; 
    } catch (error) {
      console.error("Logout failed:", error);
    }
  }
  export { handleLogout };