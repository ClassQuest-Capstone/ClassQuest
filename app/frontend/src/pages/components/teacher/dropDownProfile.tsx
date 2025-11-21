import React, { useState, useEffect} from 'react';
import { Link } from 'react-router-dom';
import feather from 'feather-icons';


const DropDownProfile: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    feather.replace();
  }, []);

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  return(
    <div> click</div>
  );
}
