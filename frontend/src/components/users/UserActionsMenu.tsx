import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Shield, Edit2, Key, UserCheck, UserX, Trash2 } from 'lucide-react';
import { User } from '../../types/user';

interface UserActionsMenuProps {
  user: User;
  onViewPermissions: (user: User) => void;
  onEdit: (user: User) => void;
  onChangePassword: (user: User) => void;
  onToggleStatus: (user: User) => void;
  onDelete: (user: User) => void;
}

export const UserActionsMenu: React.FC<UserActionsMenuProps> = ({
  user,
  onViewPermissions,
  onEdit,
  onChangePassword,
  onToggleStatus,
  onDelete
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const toggleMenu = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 260; // Approximate height of the menu
      const windowHeight = window.innerHeight;
      
      let top = rect.bottom + window.scrollY;
      let left = rect.right - 200; // 200px dropdown width, aligned to right

      // Prevent going off right edge
      if (left < 0) left = rect.left;

      // Check if we need to open upwards
      if (rect.bottom + dropdownHeight > windowHeight && rect.top - dropdownHeight > 0) {
        top = rect.top + window.scrollY - dropdownHeight - 5; // 5px gap
      }

      setDropdownStyle({
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        width: '200px',
        zIndex: 9999, // Super high z-index
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isOpen && buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        // We also need to check if they clicked inside the portal dropdown.
        // We can do this by assigning an ID or class to the portal container and checking it.
        const target = event.target as Element;
        if (!target.closest('.user-actions-dropdown')) {
          setIsOpen(false);
        }
      }
    };
    
    const handleScroll = () => {
      if (isOpen) setIsOpen(false); // Close on scroll to avoid detached dropdown
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true); // true to capture scroll on any element
    window.addEventListener('resize', handleScroll);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const menuContent = (
    <div 
      className="user-actions-dropdown bg-white rounded-xl shadow-lg border border-slate-100 py-2 overflow-hidden flex flex-col"
      style={dropdownStyle}
    >
      <button
        onClick={() => handleAction(() => onViewPermissions(user))}
        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full text-left"
      >
        <Shield className="w-4 h-4 text-emerald-600" />
        View Permissions
      </button>
      
      <button
        onClick={() => handleAction(() => onEdit(user))}
        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full text-left"
      >
        <Edit2 className="w-4 h-4 text-blue-600" />
        Edit User
      </button>

      <button
        onClick={() => handleAction(() => onChangePassword(user))}
        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors w-full text-left"
      >
        <Key className="w-4 h-4 text-amber-600" />
        Change Password
      </button>

      <div className="h-px bg-slate-100 my-1 mx-4"></div>

      <button
        onClick={() => handleAction(() => onToggleStatus(user))}
        disabled={user.isPrimaryAdmin}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors w-full text-left ${
          user.isPrimaryAdmin 
            ? 'text-slate-400 opacity-50 cursor-not-allowed' 
            : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        {user.status === 'active' || user.status === 'Active' ? (
          <>
            <UserX className="w-4 h-4 text-orange-600" />
            Inactive
          </>
        ) : (
          <>
            <UserCheck className="w-4 h-4 text-emerald-600" />
            Active
          </>
        )}
      </button>

      <div className="h-px bg-slate-100 my-1 mx-4"></div>

      <button
        onClick={() => handleAction(() => onDelete(user))}
        disabled={user.isPrimaryAdmin}
        className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors w-full text-left ${
          user.isPrimaryAdmin 
            ? 'text-slate-400 opacity-50 cursor-not-allowed' 
            : 'text-red-600 hover:bg-red-50'
        }`}
      >
        <Trash2 className="w-4 h-4" />
        Delete User
      </button>
    </div>
  );

  return (
    <>
      <button 
        ref={buttonRef}
        onClick={toggleMenu}
        className={`p-1.5 rounded-lg transition-colors ${isOpen ? 'bg-slate-200 text-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}`}
      >
        <MoreVertical className="w-5 h-5" />
      </button>
      
      {isOpen && createPortal(menuContent, document.body)}
    </>
  );
};
