const Header = () => {
    return (
        <header className="py-8 px-4">
            <div className="max-w-[1600px] mx-auto flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-blue-500/20">
                    A
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">
                        ATR Signal
                    </h1>
                    <p className="text-sm text-gray-500">
                        ATR based trailing stop & buy signal analysis
                    </p>
                </div>
            </div>
        </header>
    );
};

export default Header;
