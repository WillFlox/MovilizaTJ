type AppHeaderProps = {
  gpsStatus: string;
};

export function AppHeader({ gpsStatus }: AppHeaderProps) {
  return (
    <header className="navbar">
      <div className="logo">
        <div className="logo-icon">♿</div>
        Tijuana Sin Barreras
      </div>
      <div className="user-profile">{gpsStatus}</div>
    </header>
  );
}
