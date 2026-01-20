
import React from 'react';

// Simple Phone Icon
const PhoneIcon = ({ className }: any) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('path', { d: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" }));

const XIcon = ({ className }: any) => React.createElement('svg', { className, xmlns: "http://www.w3.org/2000/svg", width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement('line', {x1:"18", y1:"6", x2:"6", y2:"18"}), React.createElement('line', {x1:"6", y1:"6", x2:"18", y2:"18"}));

export const CallOverlay = ({ name, number, onClose }: any) => {
    return React.createElement('div', { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in" },
        React.createElement('div', { className: "text-center p-8 rounded-3xl bg-gray-900 border border-green-500/30 shadow-[0_0_50px_rgba(34,197,94,0.2)] max-w-sm w-full relative" },
            React.createElement('div', { className: "w-24 h-24 bg-green-500/20 rounded-full mx-auto mb-6 flex items-center justify-center animate-pulse" },
                React.createElement(PhoneIcon, { className: "w-10 h-10 text-green-400" })
            ),
            React.createElement('h2', { className: "text-2xl font-bold text-white mb-2" }, "Calling..."),
            React.createElement('h3', { className: "text-xl text-green-400 mb-1" }, name),
            React.createElement('p', { className: "text-gray-400 font-mono text-lg mb-8 tracking-wider" }, number),
            
            React.createElement('div', { className: "flex justify-center gap-4" },
                React.createElement('button', {
                    onClick: onClose,
                    className: "px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-full font-bold border border-red-500/50 transition-all flex items-center gap-2"
                }, 
                    React.createElement(XIcon, { className: "w-5 h-5" }),
                    "Cancel"
                )
            )
        )
    );
};
