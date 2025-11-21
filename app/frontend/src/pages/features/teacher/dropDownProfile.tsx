import React, { useState, useEffect} from 'react';
import { Link } from 'react-router-dom';
import feather from 'feather-icons';



type DropDownProfileProps = {
  username: string;
  onLogout: () => void;
};

const DropDownProfile = ({ username, onLogout }: DropDownProfileProps) => {
  return (
    <div className="dropdown">
      <span>{username}</span>
      <button onClick={onLogout}>Logout</button>
    </div>
  );
};

export default DropDownProfile;

