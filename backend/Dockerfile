# syntax=docker/dockerfile:1

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY backend/Directory.Build.props ./
COPY backend/Vanguard.sln ./
COPY backend/src/Vanguard.Domain/Vanguard.Domain.csproj ./src/Vanguard.Domain/
COPY backend/src/Vanguard.Api/Vanguard.Api.csproj ./src/Vanguard.Api/

RUN dotnet restore ./src/Vanguard.Api/Vanguard.Api.csproj

COPY backend/src ./src
RUN dotnet publish ./src/Vanguard.Api/Vanguard.Api.csproj \
    -c Release \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish ./
USER app

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health || exit 1

ENTRYPOINT ["dotnet", "Vanguard.Api.dll"]
